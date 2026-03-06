import { Text } from 'pixi.js';
import type { BaseCommand, Script, SceneMap } from '../types';
import type { Engine } from '../Engine';
import { preloadSceneAssets } from '../utils/AssetPreloader';

export class SceneManager {
    private engine: Engine;
    private scenes: SceneMap = {};
    private templates: Map<string, Script> = new Map();

    public script: Script = [];
    public currentIndex: number = 0;
    public currentSceneName: string = "";

    private originMap: number[] = [];

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
        const injectedOrigins = commands.map(() => -1);
        this.script.splice(this.currentIndex, 0, ...commands);
        this.originMap.splice(this.currentIndex, 0, ...injectedOrigins);
    }

    public getOriginalIndex(runtimeIndex: number): number {
        return this.originMap[runtimeIndex] ?? -1;
    }

    public getLastOriginalIndex(runtimeIndex: number): number {
        for (let i = runtimeIndex; i >= 0; i--) {
            const orig = this.originMap[i];
            if (orig !== -1) return orig;
        }
        return 0;
    }

    public async jumpToScene(sceneName: string, startIndex: number = 0) {
        if (!this.scenes[sceneName]) {
            this.engine.logger.error(`Scene '${sceneName}' missing.`);
            return;
        }

        const loadingText = new Text({
            text: "Loading...",
            style: { fill: 0xffffff, fontFamily: this.engine.theme.fontFamily }
        });
        loadingText.anchor.set(1, 1);
        loadingText.position.set(this.engine.display.width - 20, this.engine.display.height - 20);
        this.engine.layers.overlay.addChild(loadingText);

        await preloadSceneAssets(this.engine, this.scenes[sceneName]);

        loadingText.destroy();

        this.currentSceneName = sceneName;
        this.script = [...this.scenes[sceneName]];
        this.originMap = this.script.map((_, i) => i);
        this.currentIndex = startIndex;
    }
}