import { Assets } from 'pixi.js';

import type { EngineConfig } from './EngineConfig';
import type { HandlerRuntime } from './execution/ExecutionContext';
import type {
    CommandHandlerProvider,
    CommandHandlerRegistry,
    RegisteredCommandHandler,
} from './interfaces/ICommandHandler';
import type {
    IAssetManager,
    IAudioManager,
    IDisplayManager,
    IEventBus,
    IEvidenceManager,
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
import type { BaseCommand, CommandType, GameManifest, Serializable } from './types';

import { ScriptExecutor } from './execution/ScriptExecutor';
import { HistoryPanel } from './ui/HistoryPanel';
import { ItemBrowserPanel } from './ui/ItemBrowserPanel';
import { SaveLoadPanel } from './ui/SaveLoadPanel';
import { SettingsPanel } from './ui/SettingsPanel';
import { Logger } from './utils/Logger';
import { DefaultTheme, type Theme } from './utils/Theme';

export type AssetResolver = (url: string) => string;

export interface EngineDeps {
    assets: IAssetManager;
    audio: IAudioManager;
    display: IDisplayManager;
    events: IEventBus;
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

export type EngineDepsFactory = (engine: Engine, config: EngineConfig) => EngineDeps;

export type EngineSystemKey = keyof EngineSystemMap;

export interface EngineSystemMap {
    assets: IAssetManager;
    audio: IAudioManager;
    display: IDisplayManager;
    events: IEventBus;
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

export class Engine {
    public config: EngineConfig;
    public logger: Logger = new Logger('[Engine]');
    public manifest: GameManifest = {};
    public readonly systems = new Map<EngineSystemKey, EngineSystemMap[EngineSystemKey]>();
    public theme: Theme = DefaultTheme;

    public get assetResolver(): AssetResolver {
        return this._assetResolver;
    }

    public set assetResolver(resolver: AssetResolver) {
        this._assetResolver = resolver;
        this.getSystem('spritesheets').setResolver(resolver);
        this.getSystem('assets').setResolver(resolver);
    }

    public get autoAdvanceDelay(): number | undefined {
        return this._autoAdvanceDelay;
    }

    public get currentIndex(): number {
        return this.getSystem('scenes').currentIndex;
    }
    public get currentSceneName(): string {
        return this.getSystem('scenes').currentSceneName;
    }
    public get isStarted(): boolean {
        return this.executor.isStarted;
    }
    public get lastSavePoint(): number {
        return this.executor.lastSavePoint;
    }
    public get persistentState(): Record<string, Serializable> {
        return this.getSystem('state').persistentState;
    }
    public get state(): Record<string, Serializable> {
        return this.getSystem('state').state;
    }

    public set state(value: Record<string, Serializable>) {
        const state = this.getSystem('state');
        state.replaceState(value, state.system);
    }

    private _autoAdvanceDelay: number | undefined;

    /* Lifecycle */

    private readonly executor: ScriptExecutor;

    private handlers: CommandHandlerRegistry = new Map();

    private onInputLoad: ((slot: number) => void) | undefined;
    private onInputNext: (() => void) | undefined;
    private onInputSave: ((slot: number) => void) | undefined;
    private onInputSkip: (() => void) | undefined;
    private readonly onSceneNavigation?: EngineConfig['onSceneNavigation'];

    constructor(config: EngineConfig = {}, depsFactory: EngineDepsFactory) {
        this.config = config;

        if (config.theme) {
            this.theme = { ...DefaultTheme, ...config.theme };
        }

        const deps = depsFactory(this, config);

        for (const key of Object.keys(deps) as EngineSystemKey[]) {
            this.registerSystem(key, deps[key]);
        }
        this.onSceneNavigation = config.onSceneNavigation;

        const events = this.getSystem('events');
        const scenes = this.getSystem('scenes');

        const runtime: HandlerRuntime = {
            assetResolver: (url: string) => this.assetResolver(url),
            consumeSkip: () => this.consumeSkip(),
            getAutoAdvanceDelay: () => this.autoAdvanceDelay,
            getManifest: () => this.manifest,
            getState: <T = unknown>(key: string) => this.getState<T>(key),
            getTheme: () => this.theme,
            injectCommands: () => {},
            loadAsset: <T = unknown>(url: string) => this.loadAsset<T>(url),
            logger: this.logger,
            playNext: () => this.playNext(),
            resolveText: (text: string) => this.resolveText(text),
            runCommand: async (command: BaseCommand) => {
                await this.runCommand(command);
            },
            setState: (key: string, value: unknown) => this.setState(key, value),
        };

        this.executor = new ScriptExecutor({
            events,
            handlers: this.handlers,
            logger: this.logger,
            onSceneNavigation: this.onSceneNavigation,
            runtime,
            scenes,
            systems: this,
        });
        runtime.injectCommands = (commands: BaseCommand[]) => {
            this.executor.injectCommands(commands);
        };

        this.subscribeInputEvents();
    }

    /* Handler Registration */

    public async applySaveState(saveData: SaveState) {
        this.clear();

        this.getSystem('state').replaceState(saveData.state, saveData.system);
        if (saveData.system.items.length > 0) {
            this.getSystem('items').deserialize(saveData.system.items);
        }

        this.getSystem('events').emit('state:loaded', saveData);

        await this.getSystem('scenes').jumpToScene(saveData.sceneName, saveData.index);
        if (this.isStarted) {
            await this.playNext();
        }
    }

    public clear() {
        this.getSystem('display').clearLayers?.();
        for (const h of this.handlers.values()) h.reset?.();
        this.getSystem('history').clear();
        this.getSystem('items').clear();
        this.getSystem('state').clear();
        this.executor.reset();
    }

    public consumeSkip(): boolean {
        return this.executor.consumeSkip();
    }

    /* State */

    public destroy() {
        this.executor.stop();
        this.unsubscribeInputEvents();
        this.getSystem('input').detach();
        void this.getSystem('display').destroy?.();
        void this.getSystem('audio').destroy?.();
        this.clear();
    }

    public getHandler(type: CommandType): RegisteredCommandHandler | undefined {
        return this.handlers.get(type);
    }

    public getState<T = Serializable>(k: string): T | undefined {
        return this.getSystem('state').get<T>(k);
    }

    public getSystem<K extends EngineSystemKey>(key: K): EngineSystemMap[K] {
        const system = this.systems.get(key);
        if (!system) {
            throw new Error(`Engine system '${key}' is not registered`);
        }
        return system as EngineSystemMap[K];
    }

    /* Text Control */

    public async init(canvasElement: HTMLCanvasElement) {
        await this.getSystem('display').init(canvasElement);
        await this.getSystem('audio').init?.();

        this.getSystem('input').attach(canvasElement);
    }

    public async loadAsset<T = unknown>(url: string): Promise<T> {
        const resolvedUrl = this.assetResolver(url);
        return await Assets.load<T>(resolvedUrl);
    }

    public async playNext() {
        await this.executor.playNext();
    }

    public registerDefaultPanels() {
        const overlay = this.getSystem('overlay');
        overlay.registerPanel(new HistoryPanel());
        overlay.registerPanel(new ItemBrowserPanel());
        overlay.registerPanel(new SettingsPanel());
        overlay.registerPanel(new SaveLoadPanel('save'));
        overlay.registerPanel(new SaveLoadPanel('load'));
    }

    public registerHandler(h: RegisteredCommandHandler) {
        this.handlers.set(h.type, h);
        if (h.init) {
            void Promise.resolve(h.init(this.executor.getContext())).catch((error: unknown) => {
                this.logger.error(`Handler '${h.type}' init failed: ${String(error)}`);
            });
        }
    }

    /* Command Execution */

    public registerHandlers(hs: CommandHandlerProvider[]) {
        for (const h of hs) this.registerHandler(typeof h === 'function' ? new h() : h);
    }

    public registerSystem<K extends EngineSystemKey>(key: K, system: EngineSystemMap[K]) {
        this.systems.set(key, system);
    }

    public requestSkip() {
        this.executor.requestSkip();
    }

    public resolveText(text: string): string {
        const state = this.getSystem('state');
        return text.replaceAll(/\{(\w+)}/g, (match: string, key: string) => {
            const value = state.get(key) ?? state.getPersistent(key);
            if (value === undefined || value === null) return match;
            if (typeof value === 'object') return JSON.stringify(value);
            return String(value);
        });
    }

    /* Scene Delegation */


    /* Convenience Getters */

    public async runCommand(command: BaseCommand) {
        await this.executor.runCommand(command);
    }

    public setAutoAdvance(delayMs: number | undefined) {
        this._autoAdvanceDelay = delayMs;
    }

    public setInputEnabled(enabled: boolean) {
        const display = this.getSystem('display');
        const input = this.getSystem('input');
        if (display.canvas) {
            if (enabled) {
                input.attach(display.canvas);
            } else {
                input.detach();
            }
        }
    }

    public setManifest(manifest: GameManifest) {
        this.manifest = manifest;
    }


    /* Input */

    public setState(k: string, v: unknown) {
        this.getSystem('state').set(k, v);
    }

    /* Assets */

    public start() {
        this.executor.start();
    }

    private _assetResolver: AssetResolver = (url) => url;

    private subscribeInputEvents() {
        const events = this.getSystem('events');
        this.onInputSkip = () => {
            this.executor.requestSkip();
        };
        this.onInputNext = () => {
            void this.executor.playNext();
        };
        this.onInputSave = (slot: number) => {
            this.getSystem('saves').save(slot);
            this.getSystem('notifications').show('Game Saved!');
        };
        this.onInputLoad = (slot: number) => {
            void this.getSystem('saves').load(slot).then(async (saveData) => {
                if (!saveData) {
                    this.getSystem('notifications').show('Save not found');
                    return;
                }
                await this.applySaveState(saveData);
                this.getSystem('notifications').show('Game Loaded!');
            });
        };

        events.on('input:skip', this.onInputSkip);
        events.on('input:next', this.onInputNext);
        events.on('input:save', this.onInputSave);
        events.on('input:load', this.onInputLoad);
    }

    private unsubscribeInputEvents() {
        const events = this.getSystem('events');
        if (this.onInputSkip) {
            events.off('input:skip', this.onInputSkip);
            this.onInputSkip = undefined;
        }
        if (this.onInputNext) {
            events.off('input:next', this.onInputNext);
            this.onInputNext = undefined;
        }
        if (this.onInputSave) {
            events.off('input:save', this.onInputSave);
            this.onInputSave = undefined;
        }
        if (this.onInputLoad) {
            events.off('input:load', this.onInputLoad);
            this.onInputLoad = undefined;
        }
    }



}

