import type { BaseCommand, SceneMap, Script } from '../../types';
import type { IBaseManager } from './IBaseManager';

export interface ISceneManager extends IBaseManager {
    addScene(name: string, script: Script): void;
    currentIndex: number;
    currentSceneName: string;
    getCommandAt(index: number): BaseCommand | undefined;
    getLastOriginalIndex(runtimeIndex: number): number;
    getOriginalIndex(runtimeIndex: number): number;
    getTemplate(name: string): Script | undefined;
    hasScene(name: string): boolean;
    injectCommands(commands: BaseCommand[]): void;
    jumpToScene(sceneName: string, startIndex?: number): Promise<void>;
    loadScenes(scenes: SceneMap): void;
    registerTemplate(name: string, script: Script): void;
    readonly script: Script;
    readonly scriptLength: number;
}

