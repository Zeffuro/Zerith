import { Application, Assets, Container } from 'pixi.js';
import type { BaseCommand, CommandHandler, CommandType, GameManifest } from './types';
import type { EngineConfig } from './EngineConfig';
import { Logger } from './utils/Logger';
import type { SaveManager } from './managers/SaveManager';
import type { AudioManager } from './managers/AudioManager';
import type { DisplayManager } from './managers/DisplayManager';
import type { InputManager } from './managers/InputManager';
import type { SceneManager } from './managers/SceneManager';
import type { EventBus } from './managers/EventBus';
import type { NotificationManager } from './managers/NotificationManager';
import type { StartScreenManager } from './managers/StartScreenManager';
import type { HistoryManager } from './managers/HistoryManager';
import type { OverlayManager } from './managers/OverlayManager';
import type { EvidenceManager } from './managers/EvidenceManager';
import type { SpritesheetManager } from './managers/SpritesheetManager';
import type { AssetManager } from './managers/AssetManager';
import { DefaultTheme, type Theme } from './utils/Theme';
import { SettingsPanel } from './ui/SettingsPanel';
import { HistoryPanel } from './ui/HistoryPanel';
import { SaveLoadPanel } from './ui/SaveLoadPanel';
import { ItemBrowserPanel } from './ui/ItemBrowserPanel';

export type AssetResolver = (url: string) => string;

export interface EngineDeps {
    audio: AudioManager;
    display: DisplayManager;
    input: InputManager;
    scenes: SceneManager;
    saves: SaveManager;
    events: EventBus;
    notifications: NotificationManager;
    startScreen: StartScreenManager;
    overlay: OverlayManager;
    history: HistoryManager;
    items: EvidenceManager;
    spritesheets: SpritesheetManager;
    assets: AssetManager;
}

export type EngineDepsFactory = (engine: Engine, config: EngineConfig) => EngineDeps;

export class Engine {
    public app: Application;
    public layers: {
        background: Container;
        sprites: Container;
        ui: Container;
        overlay: Container;
    };

    public audio: AudioManager;
    public display: DisplayManager;
    public input: InputManager;
    public scenes: SceneManager;
    public saves: SaveManager;
    public events: EventBus;
    public notifications: NotificationManager;
    public startScreen: StartScreenManager;
    public overlay: OverlayManager;
    public history: HistoryManager;
    public items: EvidenceManager;
    public spritesheets: SpritesheetManager;
    public assets: AssetManager;
    public logger: Logger = new Logger('[Engine]');
    public theme: Theme = DefaultTheme;
    public state: Record<string, any> = {};
    public persistentState: Record<string, any> = {};
    public manifest: GameManifest = {};

    private handlers: Map<CommandType, CommandHandler<any>> = new Map();
    private isExecuting = false;
    private _isStarted = false;
    private _skipRequested = false;
    private _autoAdvanceDelay: number | null = null;
    private _lastSavePoint: number = 0;

    private _assetResolver: AssetResolver = (url) => url;

    private readonly onSceneNavigation?: EngineConfig['onSceneNavigation'];

    constructor(config: EngineConfig = {}, depsFactory: EngineDepsFactory) {
        this.app = new Application();
        this.layers = {
            background: new Container(),
            sprites: new Container(),
            ui: new Container(),
            overlay: new Container()
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
    }

    public registerDefaultPanels() {
        this.overlay.registerPanel(new HistoryPanel());
        this.overlay.registerPanel(new ItemBrowserPanel());
        this.overlay.registerPanel(new SettingsPanel());
        this.overlay.registerPanel(new SaveLoadPanel('save'));
        this.overlay.registerPanel(new SaveLoadPanel('load'));
    }

    /* Lifecycle */

    public async init(canvasElement: HTMLCanvasElement) {
        await this.display.init(canvasElement);
        this.audio.init();

        this.app.stage.addChild(
            this.layers.background,
            this.layers.sprites,
            this.layers.ui,
            this.layers.overlay
        );

        this.input.attach(canvasElement);
    }

    public start() {
        this._isStarted = true;
        this.playNext();
    }

    public get isStarted(): boolean {
        return this._isStarted;
    }

    public clear() {
        this.layers.ui.removeChildren().forEach(c => c.destroy({ children: true }));
        this.layers.sprites.removeChildren().forEach(c => c.destroy({ children: true }));
        this.layers.overlay.removeChildren().forEach(c => c.destroy({ children: true }));
        this.handlers.forEach(h => h.reset?.());
        this.history.clear();
        this.items.clear();
        this.state = {};
        this.isExecuting = false;
    }

    public destroy() {
        this._isStarted = false;
        this.input.detach();
        this.display.destroy();
        this.audio.destroy();
        this.clear();
    }

    /* Handler Registration */

    public registerHandler<T extends BaseCommand>(h: CommandHandler<T>) {
        this.handlers.set(h.type, h);
    }

    public registerHandlers(hs: (CommandHandler<any> | (new (...args: any[]) => CommandHandler<any>))[]) {
        hs.forEach(h => this.registerHandler(typeof h === 'function' ? new h() : h));
    }

    public getHandler(type: CommandType): CommandHandler<any> | undefined {
        return this.handlers.get(type);
    }

    /* State */

    public getState(k: string) {
        return this.state[k];
    }

    public setState(k: string, v: any) {
        this.state[k] = v;
    }

    /* Text Control */

    public requestSkip() {
        if (this.isExecuting) {
            this._skipRequested = true;
        }
    }

    public consumeSkip(): boolean {
        if (this._skipRequested) {
            this._skipRequested = false;
            return true;
        }
        return false;
    }

    public get autoAdvanceDelay(): number | null {
        return this._autoAdvanceDelay;
    }

    public setAutoAdvance(delayMs: number | null) {
        this._autoAdvanceDelay = delayMs;
    }

    public resolveText(text: string): string {
        return text.replace(/\{(\w+)}/g, (match, key) => {
            if (this.state[key] !== undefined) return this.state[key];
            if (this.persistentState[key] !== undefined) return this.persistentState[key];
            return match;
        });
    }

    /* Command Execution */

    public async runCommand(command: BaseCommand) {
        const handler = this.handlers.get(command.type);
        if (!handler) {
            this.logger.warn(`No handler registered for command type '${command.type}'`);
            return;
        }

        try {
            await handler.execute(command, this);
        } catch (err) {
            this.logger.error(
                `Handler '${command.type}' threw during execute: ${err}`
            );
        }
    }

    public async playNext() {
        if (this.isExecuting || !this._isStarted) return;
        this.isExecuting = true;

        try {
            while (this.scenes.currentIndex < this.scenes.scriptLength) {
                const idx = this.scenes.currentIndex;
                const command = this.scenes.getCommandAt(this.scenes.currentIndex++);
                if (!command) break;
                await this.runCommand(command);

                if (this.shouldSkipSceneNavigation(command)) {
                    return;
                }

                const handler = this.handlers.get(command.type);
                if (handler && !handler.autoNext) {
                    this._lastSavePoint = this.scenes.getLastOriginalIndex(idx);
                    this.isExecuting = false;
                    return;
                }
            }
        } catch (err) {
            const index = this.scenes.currentIndex - 1;
            const command = this.scenes.getCommandAt(index);
            this.logger.error(
                `Error executing command at index ${index} (type: '${command?.type}'): ${err}`
            );
        } finally {
            this.isExecuting = false;
        }
    }

    private shouldSkipSceneNavigation(command: BaseCommand): boolean {
        if (command.type !== 'jump' && command.type !== 'scene_change') {
            return false;
        }

        const sceneName = String((command as any).to ?? (command as any).scene ?? '');
        const action = this.onSceneNavigation?.(sceneName, command.type);
        if (action === 'skip') {
            this.logger.info(`[Engine] Skipping scene navigation to '${sceneName}'`);
            return true;
        }

        return false;
    }

    /* Scene Delegation */


    /* Convenience Getters */

    public get currentSceneName(): string {
        return this.scenes.currentSceneName;
    }

    public get currentIndex(): number {
        return this.scenes.currentIndex;
    }

    public get lastSavePoint(): number {
        return this._lastSavePoint;
    }


    /* Input */

    public setInputEnabled(enabled: boolean) {
        if (this.display.canvas) {
            if (enabled) {
                this.input.attach(this.display.canvas);
            } else {
                this.input.detach();
            }
        }
    }

    /* Assets */

    public async loadAsset(url: string): Promise<any> {
        const resolvedUrl = this.assetResolver(url);
        return await Assets.load(resolvedUrl);
    }

    public get assetResolver(): AssetResolver {
        return this._assetResolver;
    }

    public set assetResolver(resolver: AssetResolver) {
        this._assetResolver = resolver;
        this.spritesheets.setResolver(resolver);
        this.assets.setResolver(resolver);
    }
}