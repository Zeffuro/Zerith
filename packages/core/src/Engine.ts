import { Assets } from 'pixi.js';

import type { EngineConfig } from './EngineConfig';
import type { CommandHandlerRegistry, RegisteredCommandHandler } from './interfaces/ICommandHandler';
import type {
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

import { FlowManager } from './managers/FlowManager';
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

export class Engine {
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
    private handlers: CommandHandlerRegistry = new Map();
    private readonly onSceneNavigation?: EngineConfig['onSceneNavigation'];
    constructor(config: EngineConfig = {}, deps: EngineDeps) {
        this.config = config;
        if (config.theme) {
            this.theme = { ...DefaultTheme, ...config.theme };
        }

        this.assets = deps.assets;
        this.audio = deps.audio;
        this.display = deps.display;
        this.events = deps.events;
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

        this.onSceneNavigation = config.onSceneNavigation;
        this.flow = new FlowManager({
            events: this.events,
            handlers: this.handlers,
            logger: this.logger,
            onSceneNavigation: this.onSceneNavigation,
            scenes: this.scenes,
        });
    }

    public async applySaveState(saveData: SaveState) {
        this.clear();

        this.stateManager.replaceState(saveData.state, saveData.system);
        if (saveData.system.items.length > 0) {
            this.items.deserialize(saveData.system.items);
        }

        this.events.emit('state:loaded', saveData);

        await this.scenes.jumpToScene(saveData.sceneName, saveData.index);
        if (this.isStarted) {
            await this.playNext();
        }
    }

    public clear() {
        this.display.clearLayers?.();
        for (const handler of this.handlers.values()) {
            handler.reset?.();
        }
        this.history.clear();
        this.items.clear();
        this.stateManager.clear();
        this.flow.reset();
    }

    public consumeSkip(): boolean {
        return this.flow.consumeSkip();
    }

    public destroy() {
        this.flow.stop();
        this.input.detach();
        void this.display.destroy?.();
        void this.audio.destroy?.();
        this.clear();
    }

    public getHandler(type: BaseCommand['type']): RegisteredCommandHandler | undefined {
        return this.handlers.get(type);
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
        const resolvedUrl = this.assetResolver(url);
        return await Assets.load<T>(resolvedUrl);
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
        this.handlers.set(handler.type, handler);
    }

    public registerHandlers(handlers: RegisteredCommandHandler[]) {
        for (const handler of handlers) {
            this.registerHandler(handler);
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

    private _assetResolver: AssetResolver = (url) => url;
}

