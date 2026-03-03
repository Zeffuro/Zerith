import type { BaseCommand, Script, SceneMap } from '../types';
import type { Engine } from '../Engine';

export class SceneManager {
    private engine: Engine;
    private scenes: SceneMap = {};
    private templates: Map<string, Script> = new Map();

    public script: Script = [];
    public currentIndex: number = 0;
    public currentSceneName: string = "";

    constructor(engine: Engine) {
        this.engine = engine;
    }

    public loadScenes(scenes: SceneMap) {
        this.scenes = scenes;
    }

    public addScene(name: string, script: Script) {
        this.scenes[name] = script;
    }

    public hasScene(name: string): boolean {
        return name in this.scenes;
    }

    public registerTemplate(name: string, script: Script) {
        this.templates.set(name, script);
    }

    public getTemplate(name: string): Script | undefined {
        return this.templates.get(name);
    }

    public injectCommands(commands: BaseCommand[]) {
        this.script.splice(this.currentIndex, 0, ...commands);
    }

    public async jumpToScene(sceneName: string, startIndex: number = 0) {
        if (!this.scenes[sceneName]) {
            this.engine.logger.error(`Scene '${sceneName}' missing.`);
            return;
        }
        this.currentSceneName = sceneName;
        this.script = [...this.scenes[sceneName]];
        this.currentIndex = startIndex;
    }
}