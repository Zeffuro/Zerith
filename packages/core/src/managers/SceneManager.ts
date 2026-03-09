import type { Engine } from '../Engine';
import type { BaseCommand, RuntimeEntry, SceneMap, Script } from '../types';

export class SceneManager {
    public currentIndex: number = 0;
    public currentSceneName: string = "";
    public get script(): Script {
        return this.runtimeScript.map((entry) => entry.command);
    }
    public get scriptLength(): number {
        return this.runtimeScript.length;
    }

    private engine: Engine;
    private runtimeScript: RuntimeEntry[] = [];

    private scenes: SceneMap = {};

    private templates: Map<string, Script> = new Map();

    constructor(engine: Engine) {
        this.engine = engine;
    }

    public addScene(name: string, script: Script) {
        this.scenes[name] = script;
    }

    public getCommandAt(index: number): BaseCommand | undefined {
        return this.runtimeScript[index]?.command;
    }

    public getLastOriginalIndex(runtimeIndex: number): number {
        for (let index = runtimeIndex; index >= 0; index--) {
            const entry = this.runtimeScript[index];
            if (entry?.kind === 'original') return entry.originalIndex;
        }
        return 0;
    }

    public getOriginalIndex(runtimeIndex: number): number {
        const entry = this.runtimeScript[runtimeIndex];
        return entry?.kind === 'original' ? entry.originalIndex : -1;
    }

    public getTemplate(name: string): Script | undefined {
        return this.templates.get(name);
    }

    public hasScene(name: string): boolean {
        return name in this.scenes;
    }

    public injectCommands(commands: BaseCommand[]) {
        const injectedEntries: RuntimeEntry[] = commands.map((command) => ({ kind: 'injected', command }));
        this.runtimeScript.splice(this.currentIndex, 0, ...injectedEntries);
    }

    public async jumpToScene(sceneName: string, startIndex: number = 0) {
        if (!this.scenes[sceneName]) {
            this.engine.logger.error(`Scene '${sceneName}' missing.`);
            return;
        }
        this.engine.events.emit('scene:loading', sceneName);
        try {
            await this.engine.assets.preloadSceneAssets(this.scenes[sceneName]);

            this.currentSceneName = sceneName;
            this.runtimeScript = this.scenes[sceneName].map((command, originalIndex) => ({
                command,
                kind: 'original',
                originalIndex
            }));
            this.currentIndex = startIndex;
        } finally {
            this.engine.events.emit('scene:loaded', sceneName);
        }
    }

    public loadScenes(scenes: SceneMap) {
        this.scenes = scenes;
    }

    public registerTemplate(name: string, script: Script) {
        this.templates.set(name, script);
    }
}