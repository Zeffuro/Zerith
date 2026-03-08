import type { ScriptPath } from '../../utils/scriptPathUtils';

export interface ScriptState {
    rootScript: any[];
    scopePath: (string | number)[];
    selectedNodeIndex: number | null;
    selectedNodePath: ScriptPath | null;

    past: any[][];
    future: any[][];
    canUndo: () => boolean;
    canRedo: () => boolean;
    undo: () => void;
    redo: () => void;

    setScript: (script: any[]) => void;
    getActiveScript: () => any[];

    pushScope: (index: number, branch: string) => void;
    popScope: () => void;
    resetScope: () => void;

    setSelectedNode: (index: number | null) => void;
    setSelectedNodePath: (path: ScriptPath | null) => void;

    getNodeAtPath: (path: ScriptPath) => any | undefined;
    updateNodeAtPath: (path: ScriptPath, patch: Record<string, any>) => void;
    moveNodeByPath: (sourceNodePath: ScriptPath, targetArrayPath: ScriptPath, targetIndex: number) => void;
    deleteNodeByPath: (nodePath: ScriptPath) => void;
    addNodeAtPath: (arrayPath: ScriptPath, node: any, index?: number) => void;
    duplicateNodeByPath: (nodePath: ScriptPath) => void;
    pasteNodeAtPath: (targetNodePath: ScriptPath, node: any) => void;
    deleteNodesByPaths: (paths: ScriptPath[]) => void;
    duplicateNodesByPaths: (paths: ScriptPath[]) => void;
    moveNodesByPathsToArray: (paths: ScriptPath[], targetArrayPath: ScriptPath, targetIndex: number) => void;

    updateActiveScript: (newSubArray: any[]) => void;
    moveNode: (index: number, direction: 'up' | 'down') => void;
    deleteNode: (index: number) => void;
    addNode: (node: any) => void;
}

export type ScriptSet = (
    partial: Partial<ScriptState> | ((state: ScriptState) => Partial<ScriptState>)
) => void;

export type ScriptGet = () => ScriptState;

export type ScriptSlice<T> = (set: ScriptSet, get: ScriptGet) => T;

// Backward-compatible alias used by older slice modules.
export type ScriptStoreCreator<T> = ScriptSlice<T>;
