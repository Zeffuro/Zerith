import { Application, Assets, Container } from 'pixi.js';

import type { EngineConfig } from './EngineConfig';
import type {
    CommandHandlerProvider,
    CommandHandlerRegistry,
    RegisteredCommandHandler,
} from './interfaces/ICommandHandler';
import type {
    IAssetManager,
    IAudioManager,
    IDisplayManager,
    IEvidenceManager,
    IEventBus,
    IHistoryManager,
    IInputManager,
    INotificationManager,
    IOverlayManager,
    ISaveManager,
    ISceneManager,
    ISpritesheetManager,
    IStartScreenManager,
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
    public persistentState: Record<string, Serializable> = {};
    public saves: ISaveManager;
    public scenes: ISceneManager;
    public spritesheets: ISpritesheetManager;
    public startScreen: IStartScreenManager;
    public state: Record<string, Serializable> = {};
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

    private _autoAdvanceDelay: number | undefined;

    /* Lifecycle */

    private handlers: CommandHandlerRegistry = new Map();

    private readonly executor: ScriptExecutor;

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
        this.spritesheets = deps.spritesheets;
        this.assets = deps.assets;
        this.onSceneNavigation = config.onSceneNavigation;
        this.executor = new ScriptExecutor({
            engine: this,
            events: this.events,
            handlers: this.handlers,
            logger: this.logger,
            onSceneNavigation: this.onSceneNavigation,
            scenes: this.scenes,
        });
    }

    /* Handler Registration */

    public clear() {
        for (const c of this.layers.ui.removeChildren()) c.destroy({ children: true });
        for (const c of this.layers.sprites.removeChildren()) c.destroy({ children: true });
        for (const c of this.layers.overlay.removeChildren()) c.destroy({ children: true });
        for (const h of this.handlers.values()) h.reset?.();
        this.history.clear();
        this.items.clear();
        this.state = {};
        this.executor.reset();
    }

    public consumeSkip(): boolean {
        return this.executor.consumeSkip();
    }

    public destroy() {
        this.executor.stop();
        this.input.detach();
        this.display.destroy?.();
        this.audio.destroy?.();
        this.clear();
    }

    /* State */

    public getHandler(type: CommandType): RegisteredCommandHandler | undefined {
        return this.handlers.get(type);
    }

    public getState<T = Serializable>(k: string): T | undefined {
        return this.state[k] as T | undefined;
    }

    /* Text Control */

    public async init(canvasElement: HTMLCanvasElement) {
        return this.display.init(canvasElement).then(() => {
            this.audio.init?.();

            this.app.stage.addChild(
                this.layers.background,
                this.layers.sprites,
                this.layers.ui,
                this.layers.overlay
            );

            this.input.attach(canvasElement);
        });
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
            void Promise.resolve(h.init(this)).catch((error: unknown) => {
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
            const value = this.state[key] ?? this.persistentState[key];
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
        this.state[k] = this.toSerializable(v);
    }

    /* Assets */

    public start() {
        this.executor.start();
    }

    private _assetResolver: AssetResolver = (url) => url;

    private toSerializable(value: unknown): Serializable {
        if (value === null) return null;
        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
            return value;
        }
        if (Array.isArray(value)) {
            return value.map((item) => this.toSerializable(item));
        }
        if (this.isRecord(value)) {
            const serializableObject: { [key: string]: Serializable } = {};
            for (const [key, item] of Object.entries(value)) {
                if (item !== undefined) {
                    serializableObject[key] = this.toSerializable(item);
                }
            }
            return serializableObject;
        }

        return null;
    }

    private isRecord(value: unknown): value is Record<string, unknown> {
        return typeof value === 'object' && value !== null;
    }

}

