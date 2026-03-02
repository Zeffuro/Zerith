import { Application, Container } from 'pixi.js';
import { sound } from '@pixi/sound';
import type { BaseCommand, CommandHandler, Script, SceneMap } from './types';
import { Logger } from './utils/Logger';
import { SaveManager } from './managers/SaveManager';

export class Engine {
    public app: Application;
    public layers: {
        background: Container;
        sprites: Container;
        ui: Container;
        overlay: Container;
    };

    public audio = {
        bgmVolume: 1.0,
        sfxVolume: 1.0,
        voiceVolume: 1.0,
        masterVolume: 1.0,
        setMasterVolume: (v: number) => { sound.volumeAll = v; }
    };

    public state: Record<string, any> = {};

    public logger: Logger = new Logger('[Engine]');

    public saves: SaveManager;

    public currentIndex: number = 0;
    public currentSceneName: string = "";

    private handlers: Map<string, CommandHandler<any>> = new Map();
    private templates: Map<string, Script> = new Map();

    private script: Script =[];
    private scenes: SceneMap = {};
    private isExecuting = false;

    constructor() {
        this.app = new Application();
        this.layers = {
            background: new Container(),
            sprites: new Container(),
            ui: new Container(),
            overlay: new Container()
        };
        this.saves = new SaveManager(this);
    }

    public setState(key: string, value: any) {
        this.state[key] = value;
        this.logger.info(`State changed: ${key} = ${value}`);
    }

    public getState(key: string): any {
        return this.state[key];
    }

    public registerTemplate(name: string, script: Script) {
        this.templates.set(name, script);
        this.logger.info(`Template '${name}' registered.`);
    }

    public getTemplate(name: string): Script | undefined {
        return this.templates.get(name);
    }

    public registerHandler<T extends BaseCommand>(handler: CommandHandler<T>) {
        this.handlers.set(handler.type, handler);
        this.logger.info(`Handler for '${handler.type}' linked.`);
    }

    public registerHandlers(handlers: (new () => CommandHandler<any>)[] | CommandHandler<any>[]) {
        handlers.forEach(h => {
            const instance = typeof h === 'function' ? new (h as any)() : h;
            this.registerHandler(instance);
        });
    }

    async init(canvasElement: HTMLCanvasElement) {
        await this.app.init({
            canvas: canvasElement,
            width: 800,
            height: 600,
            backgroundColor: 0x222222,
        });

        sound.init();

        this.app.stage.addChild(this.layers.background);
        this.app.stage.addChild(this.layers.sprites);
        this.app.stage.addChild(this.layers.ui);
        this.app.stage.addChild(this.layers.overlay);

        canvasElement.addEventListener('pointerdown', () => this.playNext());
        this.logger.info("Initialized successfully.");
    }

    public injectCommands(commands: BaseCommand[]) {
        this.script.splice(this.currentIndex, 0, ...commands);
    }

    public async runCommand(command: BaseCommand) {
        const handler = this.handlers.get(command.type);
        if (handler) {
            await handler.execute(command, this);
        } else {
            this.logger.warn(`No handler for type: ${command.type}`);
        }
    }

    async playNext() {
        if (this.isExecuting) return;
        this.isExecuting = true;

        while (this.currentIndex < this.script.length) {
            const command = this.script[this.currentIndex++];

            await this.runCommand(command);

            const handler  = this.handlers.get(command.type);
            const shouldWait = handler && !handler.autoNext;

            if (shouldWait) {
                this.isExecuting = false;
                return;
            }
        }
        this.isExecuting = false;
    }

    public loadScenes(scenes: SceneMap) { this.scenes = scenes; }

    public async jumpToScene(sceneName: string, startIndex: number = 0) {
        if (!this.scenes[sceneName]) {
            this.logger.error(`Scene '${sceneName}' not found.`);
            return;
        }

        this.currentSceneName = sceneName;
        this.script = [...this.scenes[sceneName]];
        this.currentIndex = startIndex;

        this.logger.info(`Jumped to scene: ${sceneName} (Index: ${startIndex})`);

        if (!this.isExecuting) {
            await this.playNext();
        }
    }
}