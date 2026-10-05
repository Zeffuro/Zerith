import type { FlowContinuation, PreparedSceneRestore, SceneContinuation } from '../../managers/flowContinuation';
import type { BaseCommand, SceneMap, Script } from '../../types';
import type { IBaseManager } from './IBaseManager';

export interface ISceneManager extends IBaseManager {
    addScene(name: string, script: Script): void;
    cancelSceneLoad?(): void;
    captureSceneContinuation?(): SceneContinuation;
    commitSaveRestore?(prepared: PreparedSceneRestore): void;
    currentIndex: number;
    currentSceneName: string;
    getCommandAt(index: number): BaseCommand | undefined;
    getLastOriginalIndex(runtimeIndex: number): number;
    getOriginalIndex(runtimeIndex: number): number;
    getTemplate(name: string): Script | undefined;
    hasScene(name: string): boolean;
    injectCommands(commands: BaseCommand[]): void;
    isPreparedRestoreCurrent?(prepared: PreparedSceneRestore): boolean;
    jumpToScene(sceneName: string, startIndex?: number): Promise<void>;
    loadScenes(scenes: SceneMap): void;
    prepareSaveRestore?(sceneName: string, index: number, continuation?: FlowContinuation): Promise<PreparedSceneRestore>;
    registerTemplate(name: string, script: Script): void;
    readonly script: Script;
    readonly scriptLength: number;
}

