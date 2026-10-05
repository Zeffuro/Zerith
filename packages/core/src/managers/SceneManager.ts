import type { IAssetManager, IEventBus } from '../interfaces/managers';
import type { BaseCommand, RuntimeEntry, SceneMap, Script } from '../types';
import type { FlowContinuation, PreparedSceneRestore, SceneContinuation } from './flowContinuation';

import { canonicalContinuationJson, isCursor, parseFlowContinuation, sourceFingerprint } from './flowContinuation';

export interface SceneManagerDeps {
    assets: Pick<IAssetManager, 'preloadSceneAssets'>;
    events: Pick<IEventBus, 'emit'>;
    logger: { error(message: string): void };
}

export class SceneManager {
    public currentIndex: number = 0;
    public currentSceneName: string = "";
    public get script(): Script {
        return this.runtimeScript.map((entry) => entry.command);
    }
    public get scriptLength(): number {
        return this.runtimeScript.length;
    }

    private readonly deps: SceneManagerDeps;
    private loadGeneration = 0;
    private loadingScene: string | undefined;
    private readonly preparedRestores = new WeakMap<PreparedSceneRestore, number>();
    private runtimeScript: RuntimeEntry[] = [];

    private scenes: SceneMap = {};

    private templates: Map<string, Script> = new Map();

    constructor(deps: SceneManagerDeps) {
        this.deps = deps;
    }

    public addScene(name: string, script: Script) {
        if (this.loadingScene === name) this.cancelSceneLoad();
        this.scenes[name] = script;
    }

    public cancelSceneLoad(): void {
        this.loadGeneration += 1;
        const sceneName = this.loadingScene;
        this.loadingScene = undefined;
        if (sceneName !== undefined) this.deps.events.emit('scene:loaded', sceneName);
    }

    public captureSceneContinuation(): SceneContinuation {
        const script = this.getScene(this.currentSceneName);
        const continuation = parseFlowContinuation({
            injectedCommands: [],
            nextIndex: this.currentIndex,
            runtimeScript: this.runtimeScript,
            sourceFingerprint: sourceFingerprint(script, [...this.templates]),
        });
        if (!continuation || !this.matchesOriginalScript(continuation.runtimeScript, script)) {
            throw new Error('Current scene cannot be saved safely.');
        }
        const { nextIndex, runtimeScript, sourceFingerprint: fingerprint } = continuation;
        return { nextIndex, runtimeScript, sourceFingerprint: fingerprint };
    }

    public commitSaveRestore(prepared: PreparedSceneRestore): void {
        if (!this.isPreparedContentCurrent(prepared)) throw new Error('Save restore changed before it could be applied.');
        this.preparedRestores.delete(prepared);
        this.currentSceneName = prepared.sceneName;
        this.currentIndex = prepared.index;
        this.runtimeScript = structuredClone(prepared.runtimeScript);
    }

    public getCommandAt(index: number): BaseCommand | undefined {
        return this.runtimeScript[index]?.command;
    }

    public getLastOriginalIndex(runtimeIndex: number): number {
        if (!isCursor(runtimeIndex)) return 0;
        for (let index = Math.min(runtimeIndex, this.runtimeScript.length - 1); index >= 0; index--) {
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
        return Object.hasOwn(this.scenes, name);
    }

    public injectCommands(commands: BaseCommand[]) {
        const injectedEntries: RuntimeEntry[] = commands.map((command) => ({ command, kind: 'injected' }));
        this.runtimeScript.splice(this.currentIndex, 0, ...injectedEntries);
    }

    public isPreparedRestoreCurrent(prepared: PreparedSceneRestore): boolean {
        return this.preparedRestores.get(prepared) === this.loadGeneration && this.isPreparedContentCurrent(prepared);
    }

    public async jumpToScene(sceneName: string, startIndex: number = 0) {
        const { assets, events, logger } = this.deps;
        if (!isCursor(startIndex) || (this.hasScene(sceneName) && startIndex > this.scenes[sceneName].length)) {
            throw new Error('Scene cursor is invalid.');
        }
        this.cancelSceneLoad();
        const generation = this.loadGeneration;
        const script = this.scenes[sceneName];
        if (!script) {
            logger.error(`Scene '${sceneName}' missing.`);
            return;
        }
        this.loadingScene = sceneName;
        events.emit('scene:loading', sceneName);
        try {
            await assets.preloadSceneAssets(script);
            if (generation !== this.loadGeneration) return;

            this.currentSceneName = sceneName;
            this.runtimeScript = script.map((command, originalIndex) => ({
                command,
                kind: 'original',
                originalIndex
            }));
            this.currentIndex = startIndex;
        } finally {
            if (generation === this.loadGeneration) {
                this.loadingScene = undefined;
                events.emit('scene:loaded', sceneName);
            }
        }
    }

    public loadScenes(scenes: SceneMap) {
        this.cancelSceneLoad();
        this.scenes = scenes;
    }

    public async prepareSaveRestore(sceneName: string, index: number, continuation?: FlowContinuation): Promise<PreparedSceneRestore> {
        const generation = this.loadGeneration;
        const script = this.getScene(sceneName);
        if (!isCursor(index) || index > script.length) throw new Error('Save scene cursor is invalid.');
        const parsed = continuation === undefined ? undefined : parseFlowContinuation(continuation);
        if (continuation !== undefined && !parsed) throw new Error('Save continuation is invalid.');
        const fingerprint = sourceFingerprint(script, [...this.templates]);
        if (parsed && (parsed.sourceFingerprint !== fingerprint || !this.matchesOriginalScript(parsed.runtimeScript, script))) {
            throw new Error('Scene or macro content changed since this save.');
        }
        const prepared: PreparedSceneRestore = {
            index: parsed?.nextIndex ?? index,
            runtimeScript: parsed?.runtimeScript ?? structuredClone(script.map((command, originalIndex) => ({ command, kind: 'original' as const, originalIndex }))),
            sceneName,
            sourceFingerprint: fingerprint,
        };
        const commands = [
            ...prepared.runtimeScript.map(entry => entry.command),
            ...(parsed?.injectedCommands ?? []),
            ...(parsed?.replay ? [parsed.replay.command] : []),
        ];
        this.appendReferencedTemplates(commands);
        await this.deps.assets.preloadSceneAssets(commands, { strict: true });
        if (generation !== this.loadGeneration) throw new Error('Scene navigation changed while preparing this save.');
        this.preparedRestores.set(prepared, generation);
        if (!this.isPreparedRestoreCurrent(prepared)) {
            this.preparedRestores.delete(prepared);
            throw new Error('Scene or macro content changed while preparing this save.');
        }
        return prepared;
    }

    public registerTemplate(name: string, script: Script) {
        this.templates.set(name, script);
    }

    private appendReferencedTemplates(commands: Script): void {
        const visited = new Set<string>();
        const walk = (script: Script) => {
            for (const command of script) {
                if (command.type === 'call' && typeof command.name === 'string' && !visited.has(command.name)) {
                    visited.add(command.name);
                    const template = this.templates.get(command.name);
                    if (template) {
                        commands.push(...template);
                        walk(template);
                    }
                }
                for (const key of ['commands', 'onTrue', 'onFalse', 'body']) {
                    if (Array.isArray(command[key])) walk(command[key] as Script);
                }
                if (Array.isArray(command.options)) {
                    for (const option of command.options as { commands?: Script }[]) {
                        if (Array.isArray(option.commands)) walk(option.commands);
                    }
                }
            }
        };
        walk([...commands]);
    }

    private getScene(name: string): Script {
        if (!this.hasScene(name)) throw new Error(`Scene '${name}' is missing.`);
        return this.scenes[name];
    }

    private isPreparedContentCurrent(prepared: PreparedSceneRestore): boolean {
        if (!this.preparedRestores.has(prepared) || !this.hasScene(prepared.sceneName)) return false;
        if (!parseFlowContinuation({ injectedCommands: [], nextIndex: prepared.index, runtimeScript: prepared.runtimeScript, sourceFingerprint: prepared.sourceFingerprint })) return false;
        const script = this.scenes[prepared.sceneName];
        return prepared.sourceFingerprint === sourceFingerprint(script, [...this.templates])
            && isCursor(prepared.index) && prepared.index <= prepared.runtimeScript.length
            && this.matchesOriginalScript(prepared.runtimeScript, script);
    }

    private matchesOriginalScript(runtimeScript: RuntimeEntry[], script: Script): boolean {
        const originals = runtimeScript.filter(entry => entry.kind === 'original');
        return originals.length === script.length && originals.every((entry, index) => entry.kind === 'original'
            && entry.originalIndex === index && canonicalContinuationJson(entry.command) === canonicalContinuationJson(script[index]));
    }
}
