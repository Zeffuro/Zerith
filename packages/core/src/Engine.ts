import { Application, Container } from 'pixi.js';
import type { BaseCommand, CommandHandler, Script, SceneMap } from './types';
import type { EngineConfig } from './EngineConfig';
import { Logger } from './utils/Logger';
import { SaveManager } from './managers/SaveManager';
import { AudioManager } from './managers/AudioManager';
import { DisplayManager } from './managers/DisplayManager';
import { InputManager } from './managers/InputManager';
import { SceneManager } from './managers/SceneManager';
import { EventBus } from './managers/EventBus';
import { NotificationManager } from './managers/NotificationManager';
import { StartScreenManager } from './managers/StartScreenManager';
import { HistoryManager } from './managers/HistoryManager';
import { PauseMenuManager } from './managers/PauseMenuManager';
import { DefaultTheme, type Theme } from './utils/Theme';

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
    public history: HistoryManager = new HistoryManager();
    public pauseMenu: PauseMenuManager;
    public logger: Logger = new Logger('[Engine]');
    public theme: Theme = DefaultTheme;
    public state: Record<string, any> = {};
    public manifest: any = {};

    private handlers: Map<string, CommandHandler<any>> = new Map();
    private isExecuting = false;
    private _isStarted = false;
    private _skipRequested = false;
    private _autoAdvanceDelay: number | null = null;

    constructor(config: EngineConfig = {}) {
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

        this.events = new EventBus();
        this.audio = new AudioManager(config.audio);
        this.display = new DisplayManager(this.app, config.display);
        this.input = new InputManager(this, config.input);
        this.scenes = new SceneManager(this);
        this.saves = new SaveManager(this);
        this.notifications = new NotificationManager(this, config.notifications);
        this.startScreen = new StartScreenManager(this, config.startScreen);
        this.pauseMenu = new PauseMenuManager(this, config.pauseMenu);
    }

    // --- Lifecycle ---

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
        this.isExecuting = false;
    }

    public destroy() {
        this.input.detach();
        this.display.destroy();
        this.clear();
    }

    // --- Handler Registration ---

    public registerHandler<T extends BaseCommand>(h: CommandHandler<T>) {
        this.handlers.set(h.type, h);
    }

    public registerHandlers(hs: (CommandHandler<any> | (new (...args: any[]) => CommandHandler<any>))[]) {
        hs.forEach(h => this.registerHandler(typeof h === 'function' ? new h() : h));
    }

    // --- State ---

    public getState(k: string) {
        return this.state[k];
    }

    public setState(k: string, v: any) {
        this.state[k] = v;
    }

    // --- Text Control ---

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

    // --- Command Execution ---

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
            while (this.scenes.currentIndex < this.scenes.script.length) {
                const command = this.scenes.script[this.scenes.currentIndex++];
                await this.runCommand(command);
                const handler = this.handlers.get(command.type);
                if (handler && !handler.autoNext) {
                    this.isExecuting = false;
                    return;
                }
            }
        } catch (err) {
            const index = this.scenes.currentIndex - 1;
            const command = this.scenes.script[index];
            this.logger.error(
                `Error executing command at index ${index} (type: '${command?.type}'): ${err}`
            );
        } finally {
            this.isExecuting = false;
        }
    }

    // --- Scene Delegation ---

    public loadScenes(scenes: SceneMap) {
        this.scenes.loadScenes(scenes);
    }

    public registerTemplate(name: string, script: Script) {
        this.scenes.registerTemplate(name, script);
    }

    public getTemplate(name: string): Script | undefined {
        return this.scenes.getTemplate(name);
    }

    public injectCommands(commands: BaseCommand[]) {
        this.scenes.injectCommands(commands);
    }

    public async jumpToScene(sceneName: string, startIndex: number = 0) {
        await this.scenes.jumpToScene(sceneName, startIndex);
        if (this._isStarted) await this.playNext();
    }

    // --- Convenience Getters ---

    public get currentSceneName(): string {
        return this.scenes.currentSceneName;
    }

    public get currentIndex(): number {
        return this.scenes.currentIndex;
    }

    // --- Events ---

    public on(event: string, listener: (...args: any[]) => void) {
        this.events.on(event, listener);
    }

    public off(event: string, listener: (...args: any[]) => void) {
        this.events.off(event, listener);
    }

    public emit(event: string, ...args: any[]) {
        this.events.emit(event, ...args);
    }
}