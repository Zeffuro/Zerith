import { Application, Assets, Container } from 'pixi.js';

import type { EngineConfig } from './EngineConfig';
import type { JumpCommand } from './handlers/JumpHandler';
import type { SceneChangeCommand } from './handlers/SceneChangeHandler';
import type { AssetManager } from './managers/AssetManager';
import type { AudioManager } from './managers/AudioManager';
import type { DisplayManager } from './managers/DisplayManager';
import type { EventBus } from './managers/EventBus';
import type { EvidenceManager } from './managers/EvidenceManager';
import type { HistoryManager } from './managers/HistoryManager';
import type { InputManager } from './managers/InputManager';
import type { NotificationManager } from './managers/NotificationManager';
import type { OverlayManager } from './managers/OverlayManager';
import type { SaveManager } from './managers/SaveManager';
import type { SceneManager } from './managers/SceneManager';
import type { SpritesheetManager } from './managers/SpritesheetManager';
import type { StartScreenManager } from './managers/StartScreenManager';
import type { BaseCommand, CommandHandler, CommandType, GameManifest } from './types';

import { HistoryPanel } from './ui/HistoryPanel';
import { ItemBrowserPanel } from './ui/ItemBrowserPanel';
import { SaveLoadPanel } from './ui/SaveLoadPanel';
import { SettingsPanel } from './ui/SettingsPanel';
import { Logger } from './utils/Logger';
import { DefaultTheme, type Theme } from './utils/Theme';

export type AssetResolver = (url: string) => string;

export interface EngineDeps {
    assets: AssetManager;
    audio: AudioManager;
    display: DisplayManager;
    events: EventBus;
    history: HistoryManager;
    input: InputManager;
    items: EvidenceManager;
    notifications: NotificationManager;
    overlay: OverlayManager;
    saves: SaveManager;
    scenes: SceneManager;
    spritesheets: SpritesheetManager;
    startScreen: StartScreenManager;
}

export type EngineDepsFactory = (engine: Engine, config: EngineConfig) => EngineDeps;

export class Engine {
    public app: Application;
    public assets: AssetManager;
    public audio: AudioManager;
    public config: EngineConfig;

    public display: DisplayManager;
    public events: EventBus;
    public history: HistoryManager;
    public input: InputManager;
    public items: EvidenceManager;
    public layers: {
        background: Container;
        overlay: Container;
        sprites: Container;
        ui: Container;
    };
    public logger: Logger = new Logger('[Engine]');
    public manifest: GameManifest = {};
    public notifications: NotificationManager;
    public overlay: OverlayManager;
    public persistentState: Record<string, unknown> = {};
    public saves: SaveManager;
    public scenes: SceneManager;
    public spritesheets: SpritesheetManager;
    public startScreen: StartScreenManager;
    public state: Record<string, unknown> = {};
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
        return this._isStarted;
    }

    public get lastSavePoint(): number {
        return this._lastSavePoint;
    }

    private _autoAdvanceDelay: number | undefined;

    private _isStarted = false;

    private _lastSavePoint: number = 0;

    /* Lifecycle */

    private _skipRequested = false;

    private handlers: Map<CommandType, CommandHandler<BaseCommand>> = new Map();

    private isExecuting = false;

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
        this.isExecuting = false;
    }

    public consumeSkip(): boolean {
        if (this._skipRequested) {
            this._skipRequested = false;
            return true;
        }
        return false;
    }

    public destroy() {
        this._isStarted = false;
        this.input.detach();
        this.display.destroy();
        this.audio.destroy();
        this.clear();
    }

    /* State */

    public getHandler(type: CommandType): CommandHandler<BaseCommand> | undefined {
        return this.handlers.get(type);
    }

    public getState<T = unknown>(k: string): T {
        return this.state[k] as T;
    }

    /* Text Control */

    public async init(canvasElement: HTMLCanvasElement) {
        return this.display.init(canvasElement).then(() => {
            this.audio.init();

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
        if (this.isExecuting || !this._isStarted) return;
        this.isExecuting = true;

        try {
            while (this.scenes.currentIndex < this.scenes.scriptLength) {
                const index = this.scenes.currentIndex;
                const command = this.scenes.getCommandAt(this.scenes.currentIndex++);
                if (!command) break;
                await this.runCommand(command);

                if (this.shouldSkipSceneNavigation(command)) {
                    return;
                }

                const handler = this.handlers.get(command.type);
                if (handler && !handler.autoNext) {
                    this._lastSavePoint = this.scenes.getLastOriginalIndex(index);
                    this.isExecuting = false;
                    return;
                }
            }
        } catch (error) {
            const index = this.scenes.currentIndex - 1;
            const command = this.scenes.getCommandAt(index);
            const type = command ? command.type : 'unknown';
            this.logger.error(
                `Error executing command at index ${index} (type: '${type}'): ${String(error)}`
            );
        } finally {
            this.isExecuting = false;
        }
    }

    public registerDefaultPanels() {
        this.overlay.registerPanel(new HistoryPanel());
        this.overlay.registerPanel(new ItemBrowserPanel());
        this.overlay.registerPanel(new SettingsPanel());
        this.overlay.registerPanel(new SaveLoadPanel('save'));
        this.overlay.registerPanel(new SaveLoadPanel('load'));
    }

    public registerHandler<T extends BaseCommand>(h: CommandHandler<T>) {
        this.handlers.set(h.type, h as unknown as CommandHandler<BaseCommand>);
    }

    /* Command Execution */

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    public registerHandlers(hs: (CommandHandler<any> | (new (...arguments_: unknown[]) => CommandHandler<any>))[]) {
        for (const h of hs) this.registerHandler(typeof h === 'function' ? new h() : h);
    }

    public requestSkip() {
        if (this.isExecuting) {
            this._skipRequested = true;
        }
    }

    public resolveText(text: string): string {
        return text.replaceAll(/\{(\w+)}/g, (match: string, key: string) => {
            const value = this.state[key] ?? this.persistentState[key];
            if (value === undefined || value === null) return match;
            if (typeof value === 'object') return JSON.stringify(value);
            return String(value as boolean | number | string);
        });
    }

    /* Scene Delegation */


    /* Convenience Getters */

    public async runCommand(command: BaseCommand) {
        const handler = this.handlers.get(command.type);
        if (!handler) {
            this.logger.warn(`No handler registered for command type '${command.type}'`);
            return;
        }

        try {
            await handler.execute(command, this);
        } catch (error) {
            this.logger.error(
                `Handler '${command.type}' threw during execute: ${String(error)}`
            );
        }
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
        this.state[k] = v;
    }

    /* Assets */

    public start() {
        this._isStarted = true;
        void this.playNext();
    }

    private _assetResolver: AssetResolver = (url) => url;

    private shouldSkipSceneNavigation(command: BaseCommand): boolean {
        if (command.type !== 'jump' && command.type !== 'scene_change') {
            return false;
        }

        let sceneName = '';
        if (command.type === 'jump') {
            sceneName = (command as JumpCommand).to;
        } else if (command.type === 'scene_change') {
            sceneName = (command as SceneChangeCommand).assetUrl;
        }

        const action = this.onSceneNavigation?.(sceneName, command.type as 'jump' | 'scene_change');
        if (action === 'skip') {
            this.logger.info(`[Engine] Skipping scene navigation to '${sceneName}'`);
            return true;
        }

        return false;
    }
}

