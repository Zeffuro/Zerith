import { Application, Assets, Container } from 'pixi.js';

import type { EngineConfig } from './EngineConfig';
import type { ExecutionContext } from './execution/ExecutionContext';
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

export class Engine {
    public app: Application;
    public assets: IAssetManager;
    public audio: IAudioManager;
    public config: EngineConfig;

    public display: IDisplayManager;
    public events: IEventBus;
    public history: IHistoryManager;
    public input: IInputManager;
    public items: IEvidenceManager;
    public layers: {
        background: Container;
        overlay: Container;
        sprites: Container;
        ui: Container;
    };
    public logger: Logger = new Logger('[Engine]');
    public manifest: GameManifest = {};
    public notifications: INotificationManager;
    public overlay: IOverlayManager;
    public saves: ISaveManager;
    public scenes: ISceneManager;
    public spritesheets: ISpritesheetManager;
    public startScreen: IStartScreenManager;
    public stateManager: IStateManager;
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
        return this.executor.isStarted;
    }
    public get lastSavePoint(): number {
        return this.executor.lastSavePoint;
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

    /* Lifecycle */

    private readonly executionContext: ExecutionContext;
    private readonly executor: ScriptExecutor;

    private handlers: CommandHandlerRegistry = new Map();

    private readonly onSceneNavigation?: EngineConfig['onSceneNavigation'];

    constructor(config: EngineConfig = {}, depsFactory: EngineDepsFactory) {
        this.config = config;
        this.app = new Application();
        this.layers = {
            background: new Container(),
            overlay: new Container(),
            sprites: new Container(),
            ui: new Container()
        };

        if (config.theme) {
            this.theme = { ...DefaultTheme, ...config.theme };
        }

        const deps = depsFactory(this, config);

        this.events = deps.events;
        this.audio = deps.audio;
        this.display = deps.display;
        this.input = deps.input;
        this.scenes = deps.scenes;
        this.saves = deps.saves;
        this.notifications = deps.notifications;
        this.startScreen = deps.startScreen;
        this.overlay = deps.overlay;
        this.history = deps.history;
        this.items = deps.items;
        this.assets = deps.assets;
        this.stateManager = deps.state;
        this.spritesheets = deps.spritesheets;
        this.onSceneNavigation = config.onSceneNavigation;

        this.executionContext = {
            assetResolver: (url: string) => this.assetResolver(url),
            assets: this.assets,
            audio: this.audio,
            autoAdvanceDelay: this.autoAdvanceDelay,
            consumeSkip: () => this.consumeSkip(),
            display: this.display,
            events: this.events,
            getState: <T = unknown>(key: string) => this.getState<T>(key),
            history: this.history,
            injectCommands: () => {},
            items: this.items,
            layers: this.layers,
            loadAsset: <T = unknown>(url: string) => this.loadAsset<T>(url),
            logger: this.logger,
            manifest: this.manifest,
            notifications: this.notifications,
            overlay: this.overlay,
            playNext: () => this.playNext(),
            resolveText: (text: string) => this.resolveText(text),
            runCommand: async (command: BaseCommand) => {
                await this.runCommand(command);
            },
            saves: this.saves,
            scenes: this.scenes,
            setState: (key: string, value: unknown) => this.setState(key, value),
            spritesheets: this.spritesheets,
            startScreen: this.startScreen,
            stateManager: this.stateManager,
            theme: this.theme,
        };

        this.executor = new ScriptExecutor({
            context: this.executionContext,
            events: this.events,
            handlers: this.handlers,
            logger: this.logger,
            onSceneNavigation: this.onSceneNavigation,
            scenes: this.scenes,
        });
        this.executionContext.injectCommands = (commands: BaseCommand[]) => {
            this.executor.injectCommands(commands);
        };
    }

    /* Handler Registration */

    public clear() {
        for (const c of this.layers.ui.removeChildren()) c.destroy({ children: true });
        for (const c of this.layers.sprites.removeChildren()) c.destroy({ children: true });
        for (const c of this.layers.overlay.removeChildren()) c.destroy({ children: true });
        for (const h of this.handlers.values()) h.reset?.();
        this.history.clear();
        this.items.clear();
        this.stateManager.clear();
        this.executor.reset();
    }

    public consumeSkip(): boolean {
        return this.executor.consumeSkip();
    }

    public destroy() {
        this.executor.stop();
        this.input.detach();
        void this.display.destroy?.();
        void this.audio.destroy?.();
        this.clear();
    }

    /* State */

    public getHandler(type: CommandType): RegisteredCommandHandler | undefined {
        return this.handlers.get(type);
    }

    public getState<T = Serializable>(k: string): T | undefined {
        return this.stateManager.get<T>(k);
    }

    /* Text Control */

    public async init(canvasElement: HTMLCanvasElement) {
        await this.display.init(canvasElement);
        await this.audio.init?.();

        this.app.stage.addChild(
            this.layers.background,
            this.layers.sprites,
            this.layers.ui,
            this.layers.overlay
        );

        this.input.attach(canvasElement);
    }

    public async loadAsset<T = unknown>(url: string): Promise<T> {
        const resolvedUrl = this.assetResolver(url);
        return await Assets.load<T>(resolvedUrl);
    }

    public async playNext() {
        await this.executor.playNext();
    }

    public registerDefaultPanels() {
        this.overlay.registerPanel(new HistoryPanel());
        this.overlay.registerPanel(new ItemBrowserPanel());
        this.overlay.registerPanel(new SettingsPanel());
        this.overlay.registerPanel(new SaveLoadPanel('save'));
        this.overlay.registerPanel(new SaveLoadPanel('load'));
    }

    public registerHandler(h: RegisteredCommandHandler) {
        this.handlers.set(h.type, h);
        if (h.init) {
            void Promise.resolve(h.init(this.executionContext)).catch((error: unknown) => {
                this.logger.error(`Handler '${h.type}' init failed: ${String(error)}`);
            });
        }
    }

    /* Command Execution */

    public registerHandlers(hs: CommandHandlerProvider[]) {
        for (const h of hs) this.registerHandler(typeof h === 'function' ? new h() : h);
    }

    public requestSkip() {
        this.executor.requestSkip();
    }

    public resolveText(text: string): string {
        return text.replaceAll(/\{(\w+)}/g, (match: string, key: string) => {
            const value = this.stateManager.get(key) ?? this.stateManager.getPersistent(key);
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

    public setManifest(manifest: GameManifest) {
        this.manifest = manifest;
        this.executionContext.manifest = manifest;
    }

    public setAutoAdvance(delayMs: number | undefined) {
        this._autoAdvanceDelay = delayMs;
        this.executionContext.autoAdvanceDelay = delayMs;
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


    /* Input */

    public setState(k: string, v: unknown) {
        this.stateManager.set(k, v);
    }

    /* Assets */

    public start() {
        this.executor.start();
    }

    private _assetResolver: AssetResolver = (url) => url;


}

