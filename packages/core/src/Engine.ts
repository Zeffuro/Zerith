import type { EngineConfig } from './EngineConfig';
import type { RegisteredCommandHandler } from './interfaces/ICommandHandler';
import type {
    IAnimationManager,
    IAssetManager,
    IAudioManager,
    IDisplayManager,
    IEventBus,
    IEvidenceManager,
    IFlowManager,
    IHistoryManager,
    IInputManager,
    INotificationManager,
    IOverlayManager,
    ISaveManager,
    ISceneManager,
    ISpritesheetManager,
    IStartScreenManager,
    IStateManager,
} from './interfaces/managers';
import type { SaveState } from './managers/SaveManager';
import type { MenuPanel } from './types';
import type { BaseCommand, GameManifest, Serializable } from './types';
import type {
    RegisteredRuntimePlugin,
    RuntimePlugin,
    RuntimePluginActivationResult,
    RuntimePluginCleanup,
    RuntimePluginContext,
    RuntimePluginManifest,
} from './types/RuntimePlugin';

import { CURRENT_RUNTIME_PLUGIN_API_VERSION } from './types/RuntimePlugin';
import { Logger } from './utils/Logger';
import { DefaultTheme, type Theme } from './utils/Theme';

export type AssetResolver = (url: string) => Promise<string> | string;

export interface EngineDeps {
    animations: IAnimationManager;
    assets: IAssetManager;
    audio: IAudioManager;
    display: IDisplayManager;
    events: IEventBus;
    flow: IFlowManager;
    history: IHistoryManager;
    input: IInputManager;
    items: IEvidenceManager;
    notifications: INotificationManager;
    overlay: IOverlayManager;
    saves: ISaveManager;
    scenes: ISceneManager;
    spritesheets: ISpritesheetManager;
    startScreen: IStartScreenManager;
    state: IStateManager;
}

interface RuntimePluginRegistration {
    cleanups: RuntimePluginCleanup[];
    manifest: RuntimePluginManifest;
    plugin: RuntimePlugin;
}

export class Engine {
    public readonly animations: IAnimationManager;
    public readonly assets: IAssetManager;
    public readonly audio: IAudioManager;
    public config: EngineConfig;
    public readonly display: IDisplayManager;

    public readonly events: IEventBus;
    public readonly flow: IFlowManager;
    public readonly history: IHistoryManager;
    public readonly input: IInputManager;
    public readonly items: IEvidenceManager;
    public logger: Logger = new Logger('[Engine]');
    public manifest: GameManifest = {};
    public readonly notifications: INotificationManager;
    public readonly overlay: IOverlayManager;
    public readonly saves: ISaveManager;
    public readonly scenes: ISceneManager;
    public readonly spritesheets: ISpritesheetManager;
    public readonly startScreen: IStartScreenManager;
    public readonly stateManager: IStateManager;
    public theme: Theme = DefaultTheme;

    public get assetResolver(): AssetResolver {
        return this._assetResolver;
    }

    public set assetResolver(resolver: AssetResolver) {
        this._assetResolver = resolver;
        this.spritesheets.setResolver(resolver);
        this.assets.setResolver(resolver);
    }

    public get autoAdvanceDelay(): number | undefined {
        return this._autoAdvanceDelay;
    }

    public get currentIndex(): number {
        return this.scenes.currentIndex;
    }

    public get currentSceneName(): string {
        return this.scenes.currentSceneName;
    }

    public get isPaused(): boolean {
        return this.flow.isPaused;
    }

    public get isStarted(): boolean {
        return this.flow.isStarted;
    }

    public get lastSavePoint(): number {
        return this.flow.lastSavePoint;
    }

    public get persistentState(): Record<string, Serializable> {
        return this.stateManager.persistentState;
    }

    public get state(): Record<string, Serializable> {
        return this.stateManager.state;
    }

    public set state(value: Record<string, Serializable>) {
        this.stateManager.replaceState(value, this.stateManager.system);
    }

    private _autoAdvanceDelay: number | undefined;
    private readonly runtimePlugins = new Map<string, RuntimePluginRegistration>();

    constructor(config: EngineConfig = {}, deps: EngineDeps) {
        this.config = config;
        if (config.theme) {
            this.theme = { ...DefaultTheme, ...config.theme };
        }

        this.assets = deps.assets;
        this.animations = deps.animations;
        this.audio = deps.audio;
        this.display = deps.display;
        this.events = deps.events;
        this.flow = deps.flow;
        this.history = deps.history;
        this.input = deps.input;
        this.items = deps.items;
        this.notifications = deps.notifications;
        this.overlay = deps.overlay;
        this.saves = deps.saves;
        this.scenes = deps.scenes;
        this.spritesheets = deps.spritesheets;
        this.startScreen = deps.startScreen;
        this.stateManager = deps.state;
    }

    public async applySaveState(saveData: SaveState) {
        this.clear();

        this.stateManager.replaceState(saveData.state, saveData.system);
        if (saveData.system.items.length > 0) {
            this.items.deserialize(saveData.system.items);
        }
        this.history.deserialize(saveData.system.history ?? []);

        this.events.emit('state:loaded', saveData);

        await this.scenes.jumpToScene(saveData.sceneName, saveData.index);
        if (this.isStarted) {
            await this.playNext();
        }
    }

    public clear() {
        this.display.clearLayers?.();
        this.animations.clear();
        this.audio.stopAll();
        this.flow.resetHandlers();
        this.history.clear();
        this.items.clear();
        this.stateManager.clear();
        this.flow.reset();
    }

    public consumeSkip(): boolean {
        return this.flow.consumeSkip();
    }

    public async deactivatePlugin(pluginId: string): Promise<boolean> {
        const id = normalizeRuntimePluginId(pluginId);
        const registration = this.runtimePlugins.get(id);
        if (!registration) {
            return false;
        }

        this.runtimePlugins.delete(id);

        const tasks: RuntimePluginCleanup[] = [];
        if (registration.plugin.deactivate) {
            tasks.push(() => registration.plugin.deactivate?.());
        }
        tasks.push(...registration.cleanups.toReversed());

        await this.runRuntimePluginCleanupTasks(registration.manifest.id, tasks);
        return true;
    }

    public destroy() {
        const pluginDeactivateTask = this.deactivateAllPlugins();
        this.flow.stop();
        this.input.detach();
        this.clear();
        this.flow.destroyHandlers();

        const destroyTasks: Array<{
            name: string;
            run: () => Promise<void> | void;
        }> = [
            { name: 'runtimePlugins', run: () => pluginDeactivateTask },
            { name: 'animations', run: () => this.animations.destroy?.() },
            { name: 'overlay', run: () => this.overlay.destroy?.() },
            { name: 'startScreen', run: () => this.startScreen.destroy?.() },
            { name: 'notifications', run: () => this.notifications.destroy?.() },
            { name: 'saves', run: () => this.saves.destroy?.() },
            { name: 'scenes', run: () => this.scenes.destroy?.() },
            { name: 'events', run: () => this.events.destroy?.() },
            { name: 'stateManager', run: () => this.stateManager.destroy?.() },
            { name: 'history', run: () => this.history.destroy?.() },
            { name: 'items', run: () => this.items.destroy?.() },
            { name: 'spritesheets', run: () => this.spritesheets.destroy?.() },
            { name: 'assets', run: () => this.assets.destroy?.() },
            { name: 'input', run: () => this.input.destroy?.() },
            { name: 'display', run: () => this.display.destroy?.() },
            { name: 'audio', run: () => this.audio.destroy?.() },
        ];

        const destroyPromises = destroyTasks.map(({ run }) => {
            try {
                return Promise.resolve(run());
            } catch (error) {
                return Promise.reject(
                    error instanceof Error
                        ? error
                        : new Error(String(error))
                );
            }
        });

        void Promise.allSettled(destroyPromises).then((results) => {
            for (const [index, result] of results.entries()) {
                if (result.status === 'rejected') {
                    this.logger.error(
                        `Manager destroy failed (${destroyTasks[index].name}): ${String(result.reason)}`
                    );
                }
            }
        });
    }

    public getHandler(type: BaseCommand['type']): RegisteredCommandHandler | undefined {
        return this.flow.getHandler(type);
    }

    public getRegisteredPlugins(): RegisteredRuntimePlugin[] {
        return [...this.runtimePlugins.values()]
            .map((registration) => toRuntimePluginSnapshot(registration))
            .toSorted((left, right) => left.manifest.id.localeCompare(right.manifest.id));
    }

    public getState<T = Serializable>(key: string): T | undefined {
        return this.stateManager.get<T>(key);
    }

    public async init(canvasElement: HTMLCanvasElement) {
        await this.display.init(canvasElement);
        await this.audio.init?.();
        this.input.attach(canvasElement);
    }

    public async loadAsset<T = unknown>(url: string): Promise<T> {
        return await this.assets.load<T>(url);
    }

    public pause() {
        this.flow.pause();
    }

    public async playNext() {
        await this.flow.playNext();
    }

    public registerDefaultPanels(panels: MenuPanel[]) {
        for (const panel of panels) {
            this.overlay.registerPanel(panel);
        }
    }

    public registerHandler(handler: RegisteredCommandHandler) {
        this.flow.registerHandler(handler);
    }

    public registerHandlers(handlers: RegisteredCommandHandler[]) {
        this.flow.registerHandlers(handlers);
    }

    public async registerPlugin(plugin: RuntimePlugin): Promise<RegisteredRuntimePlugin> {
        const manifest = normalizeRuntimePluginManifest(plugin.manifest);
        assertRuntimePluginCompatibility(manifest);
        if (this.runtimePlugins.has(manifest.id)) {
            throw new TypeError(`Runtime plugin '${manifest.id}' is already registered.`);
        }

        const cleanups: RuntimePluginCleanup[] = [];
        const context = this.createRuntimePluginContext(manifest, cleanups);

        try {
            const activationResult = await plugin.activate(context);
            const activationCleanup = getRuntimePluginActivationCleanup(activationResult);
            if (activationCleanup) {
                cleanups.push(activationCleanup);
            }

            const registration: RuntimePluginRegistration = {
                cleanups,
                manifest,
                plugin: {
                    ...plugin,
                    manifest,
                },
            };
            this.runtimePlugins.set(manifest.id, registration);
            return toRuntimePluginSnapshot(registration);
        } catch (error) {
            await this.runRuntimePluginCleanupTasks(manifest.id, cleanups.toReversed());
            throw error;
        }
    }

    public requestSkip() {
        this.flow.requestSkip();
    }

    public resolveText(text: string): string {
        return text.replaceAll(/{(\w+)}/g, (match: string, key: string) => {
            const value = this.stateManager.get(key) ?? this.stateManager.getPersistent(key);
            if (value === undefined || value === null) return match;
            if (typeof value === 'object') return JSON.stringify(value);
            return String(value);
        });
    }

    public resume() {
        this.flow.resume();
    }

    public async runCommand(command: BaseCommand) {
        await this.flow.runCommand(command);
    }

    public setAutoAdvance(delayMs: number | undefined) {
        this._autoAdvanceDelay = delayMs;
    }

    public setInputEnabled(enabled: boolean) {
        if (this.display.canvas) {
            if (enabled) {
                this.input.attach(this.display.canvas);
            } else {
                this.input.detach();
            }
        }
    }

    public setManifest(manifest: GameManifest) {
        this.manifest = manifest;
    }

    public setState(key: string, value: unknown) {
        this.stateManager.set(key, value);
    }

    public start() {
        this.flow.start();
    }

    public step() {
        this.flow.step();
    }

    public stop() {
        this.flow.stop();
    }

    private _assetResolver: AssetResolver = (url) => url;

    private createRuntimePluginContext(
        manifest: RuntimePluginManifest,
        cleanups: RuntimePluginCleanup[],
    ): RuntimePluginContext {
        return {
            engine: this,
            manifest: { ...manifest },
            registerHandler: (handler) => {
                const previousHandler = this.flow.getHandler(handler.type);
                this.flow.registerHandler(handler);

                let disposed = false;
                const dispose = async () => {
                    if (disposed) return;
                    disposed = true;

                    const currentHandler = this.flow.getHandler(handler.type);
                    let destroyedByFlow = false;
                    if (currentHandler === handler) {
                        if (previousHandler) {
                            this.flow.registerHandler(previousHandler);
                        } else {
                            this.flow.unregisterHandler(handler.type);
                            destroyedByFlow = true;
                        }
                    }

                    if (!destroyedByFlow) {
                        await handler.destroy?.();
                    }
                };

                cleanups.push(dispose);
                return dispose;
            },
            registerPanel: (panel) => {
                const existed = this.overlay.hasPanel(panel.id);
                if (!existed) {
                    this.overlay.registerPanel(panel);
                }

                let disposed = false;
                const dispose = () => {
                    if (disposed) return;
                    disposed = true;
                    if (!existed) {
                        this.overlay.removePanel(panel.id);
                    }
                };

                cleanups.push(dispose);
                return dispose;
            },
        };
    }

    private async deactivateAllPlugins(): Promise<void> {
        const pluginIds = [...this.runtimePlugins.keys()];
        for (const pluginId of pluginIds) {
            await this.deactivatePlugin(pluginId);
        }
    }

    private async runRuntimePluginCleanupTasks(
        pluginId: string,
        tasks: RuntimePluginCleanup[],
    ): Promise<void> {
        for (const task of tasks) {
            try {
                await task();
            } catch (error) {
                this.logger.error(
                    `Runtime plugin '${pluginId}' cleanup failed: ${String(error)}`
                );
            }
        }
    }
}

function assertRuntimePluginCompatibility(manifest: RuntimePluginManifest): void {
    if (
        manifest.pluginApiVersion !== undefined
        && manifest.pluginApiVersion !== CURRENT_RUNTIME_PLUGIN_API_VERSION
    ) {
        throw new TypeError(
            `Runtime plugin '${manifest.id}' targets plugin API v${manifest.pluginApiVersion}, `
            + `but this runtime supports v${CURRENT_RUNTIME_PLUGIN_API_VERSION}.`
        );
    }
}

function getRuntimePluginActivationCleanup(
    activationResult: RuntimePluginActivationResult,
): RuntimePluginCleanup | undefined {
    if (typeof activationResult === 'function') {
        return activationResult;
    }

    if (!activationResult) {
        return undefined;
    }

    return activationResult.cleanup ?? activationResult.dispose;
}

function normalizeRuntimePluginId(id: string): string {
    const normalized = id.trim();
    if (!normalized) {
        throw new TypeError('Runtime plugin id cannot be empty.');
    }
    return normalized;
}

function normalizeRuntimePluginManifest(manifest: RuntimePluginManifest): RuntimePluginManifest {
    const id = normalizeRuntimePluginId(manifest.id);
    const name = manifest.name.trim();
    const pluginApiVersion = manifest.pluginApiVersion;
    const version = manifest.version.trim();

    if (!name) {
        throw new TypeError(`Runtime plugin '${id}' must declare a name.`);
    }

    if (!version) {
        throw new TypeError(`Runtime plugin '${id}' must declare a version.`);
    }

    return {
        ...manifest,
        capabilities: [...new Set(manifest.capabilities)]
            .toSorted((left, right) => left.localeCompare(right)),
        id,
        name,
        ...(pluginApiVersion === undefined ? {} : { pluginApiVersion }),
        version,
    };
}

function toRuntimePluginSnapshot(
    registration: RuntimePluginRegistration,
): RegisteredRuntimePlugin {
    return {
        active: true,
        capabilities: [...(registration.manifest.capabilities ?? [])],
        manifest: { ...registration.manifest },
    };
}

