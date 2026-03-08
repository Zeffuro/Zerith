import type { EditorNode } from '../../types/EditorNode';
import type { ScriptPath } from '../../utils/scriptPathUtils';

export type ScriptGet = () => ScriptState;

export type ScriptSet = (
    partial: ((state: ScriptState) => Partial<ScriptState>) | Partial<ScriptState>
) => void;

export type ScriptSlice<T> = (set: ScriptSet, get: ScriptGet) => T;


export interface ScriptState {
    addNode: (node: EditorNode) => void;
    addNodeAtPath: (arrayPath: ScriptPath, node: EditorNode, index?: number) => void;
    canRedo: () => boolean;
    canUndo: () => boolean;

    deleteNode: (index: number) => void;
    deleteNodeByPath: (nodePath: ScriptPath) => void;
    deleteNodesByPaths: (paths: ScriptPath[]) => void;
    duplicateNodeByPath: (nodePath: ScriptPath) => void;
    duplicateNodesByPaths: (paths: ScriptPath[]) => void;
    future: EditorNode[][];

    getActiveScript: () => EditorNode[];
    getNodeAtPath: (path: ScriptPath) => EditorNode | EditorNode[] | undefined;

    moveNode: (index: number, direction: 'down' | 'up') => void;
    moveNodeByPath: (sourceNodePath: ScriptPath, targetArrayPath: ScriptPath, targetIndex: number) => void;
    moveNodesByPathsToArray: (paths: ScriptPath[], targetArrayPath: ScriptPath, targetIndex: number) => void;

    moveTimelineNode: (sourceNodePath: ScriptPath, targetArrayPath: ScriptPath, targetIndex: number) => void;
    moveTimelineNodesToArray: (paths: ScriptPath[], targetArrayPath: ScriptPath, targetIndex: number) => void;

    past: EditorNode[][];
    pasteNodeAtPath: (targetNodePath: ScriptPath, node: EditorNode) => void;
    popScope: () => void;
    pushScope: (index: number, branch: string) => void;
    redo: () => void;
    resetScope: () => void;
    rootScript: EditorNode[];
    scopePath: (number | string)[];
    selectedNodeIndex: null | number;
    selectedNodePath: null | ScriptPath;
    setScript: (script: EditorNode[]) => void;
    setSelectedNode: (index: null | number) => void;

    setSelectedNodePath: (path: null | ScriptPath) => void;
    undo: () => void;
    updateActiveScript: (newSubArray: EditorNode[]) => void;
    updateNodeAtPath: (path: ScriptPath, patch: Record<string, any>) => void;
}

// Backward-compatible alias used by older slice modules.
export type ScriptStoreCreator<T> = ScriptSlice<T>;
