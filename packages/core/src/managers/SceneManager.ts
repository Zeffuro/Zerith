import { Text } from 'pixi.js';
import type { BaseCommand, Script, SceneMap } from '../types';
import type { Engine } from '../Engine';

export class SceneManager {
    private engine: Engine;
    private scenes: SceneMap = {};
    private templates: Map<string, Script> = new Map();
    private runtimeScript: Array<{ command: BaseCommand; originalIndex: number }> = [];

    public currentIndex: number = 0;
    public currentSceneName: string = "";

    public get script(): Script {
        return this.runtimeScript.map((entry) => entry.command);
    }

    public get scriptLength(): number {
        return this.runtimeScript.length;
    }

    public getCommandAt(index: number): BaseCommand | undefined {
        return this.runtimeScript[index]?.command;
    }

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
        const injectedEntries = commands.map((command) => ({ command, originalIndex: -1 }));
        this.runtimeScript.splice(this.currentIndex, 0, ...injectedEntries);
    }

    public getOriginalIndex(runtimeIndex: number): number {
        return this.runtimeScript[runtimeIndex]?.originalIndex ?? -1;
    }

    public getLastOriginalIndex(runtimeIndex: number): number {
        for (let i = runtimeIndex; i >= 0; i--) {
            const orig = this.runtimeScript[i]?.originalIndex ?? -1;
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

        await this.engine.assets.preloadSceneAssets(this.scenes[sceneName]);

        loadingText.destroy();

        this.currentSceneName = sceneName;
        this.runtimeScript = this.scenes[sceneName].map((command, originalIndex) => ({ command, originalIndex }));
        this.currentIndex = startIndex;
    }
}