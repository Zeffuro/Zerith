import {
    type ScriptPath,
    getAtPath,
    getParentArrayPath,
    getNodeIndex,
    moveNodeByPath as moveNodeByPathUtil,
    removeNodeAtPath,
    insertNodeAtPath,
    setAtPath,
} from '../../../utils/scriptPathUtils';
import { useEditorStore } from '../../useEditorStore.ts';
import { MAX_HISTORY } from '../constants';
import { deepClone, isRootIndexPath } from '../helpers';
import type { ScriptSlice, ScriptState } from '../types';

type PathOpsSlice = Pick<
    ScriptState,
    | 'getNodeAtPath'
    | 'updateNodeAtPath'
    | 'moveNodeByPath'
    | 'deleteNodeByPath'
    | 'addNodeAtPath'
    | 'duplicateNodeByPath'
    | 'pasteNodeAtPath'
    | 'deleteNodesByPaths'
    | 'duplicateNodesByPaths'
    | 'moveNodesByPathsToArray'
>;

export const createPathOpsSlice: ScriptSlice<PathOpsSlice> = (set, get) => ({
    getNodeAtPath: (path) => {
        const { rootScript } = get();
        return getAtPath(rootScript, path);
    },

    updateNodeAtPath: (path, patch) =>
        set((state) => {
            const current = getAtPath<any>(state.rootScript, path);
            if (!current || typeof current !== 'object') return {};
            const updated = { ...current, ...patch };
            const nextRoot = setAtPath(state.rootScript, path, updated);
            return {
                rootScript: nextRoot,
                past: [...state.past, state.rootScript].slice(-MAX_HISTORY),
                future: [],
            };
        }),

    moveNodeByPath: (sourceNodePath, targetArrayPath, targetIndex) =>
        set((state) => {
            const nextRoot = moveNodeByPathUtil(state.rootScript, sourceNodePath, targetArrayPath, targetIndex);

            const selected = state.selectedNodePath;
            let nextSelected = selected;

            if (
                selected &&
                selected.length === sourceNodePath.length &&
                selected.every((v, i) => v === sourceNodePath[i])
            ) {
                const sourceParent = getParentArrayPath(sourceNodePath);
                const sourceIndex = getNodeIndex(sourceNodePath);
                const sameParent =
                    sourceParent.length === targetArrayPath.length &&
                    sourceParent.every((v, i) => v === targetArrayPath[i]);
                const adjustedIndex = sameParent && sourceIndex < targetIndex ? targetIndex - 1 : targetIndex;
                nextSelected = [...targetArrayPath, adjustedIndex];
            }

            return {
                rootScript: nextRoot,
                selectedNodePath: nextSelected,
                past: [...state.past, state.rootScript].slice(-MAX_HISTORY),
                future: [],
            };
        }),

    deleteNodeByPath: (nodePath) =>
        set((state) => {
            const [nextRoot] = removeNodeAtPath(state.rootScript, nodePath);
            const selected = state.selectedNodePath;
            const isSameSelected =
                selected &&
                selected.length === nodePath.length &&
                selected.every((v, i) => v === nodePath[i]);

            return {
                rootScript: nextRoot,
                selectedNodePath: isSameSelected ? null : selected,
                past: [...state.past, state.rootScript].slice(-MAX_HISTORY),
                future: [],
            };
        }),

    addNodeAtPath: (arrayPath, node, index) =>
        set((state) => {
            const arr = getAtPath<any[]>(state.rootScript, arrayPath);
            if (!Array.isArray(arr)) return {};
            const at = index === undefined ? arr.length : index;
            const nextRoot = insertNodeAtPath(state.rootScript, arrayPath, at, node);
            return {
                rootScript: nextRoot,
                selectedNodePath: [...arrayPath, Math.max(0, Math.min(at, arr.length))],
                past: [...state.past, state.rootScript].slice(-MAX_HISTORY),
                future: [],
            };
        }),

    duplicateNodeByPath: (nodePath) =>
        set((state) => {
            const node = getAtPath<any>(state.rootScript, nodePath);
            if (node === undefined) return {};

            const parentArrayPath = getParentArrayPath(nodePath);
            const index = getNodeIndex(nodePath);
            const parentArray = getAtPath<any[]>(state.rootScript, parentArrayPath);
            if (!Array.isArray(parentArray)) return {};

            const duplicated = deepClone(node);
            const insertAt = index + 1;
            const nextRoot = insertNodeAtPath(state.rootScript, parentArrayPath, insertAt, duplicated);

            return {
                rootScript: nextRoot,
                selectedNodePath: [...parentArrayPath, insertAt],
                selectedNodeIndex:
                    parentArrayPath.length === state.scopePath.length &&
                    parentArrayPath.every((v, i) => v === state.scopePath[i])
                        ? insertAt
                        : state.selectedNodeIndex,
                past: [...state.past, state.rootScript].slice(-MAX_HISTORY),
                future: [],
            };
        }),

    pasteNodeAtPath: (targetNodePath, node) =>
        set((state) => {
            const parentArrayPath = getParentArrayPath(targetNodePath);
            const idx = getNodeIndex(targetNodePath);
            const parentArray = getAtPath<any[]>(state.rootScript, parentArrayPath);
            if (!Array.isArray(parentArray)) return {};

            const pasted = deepClone(node);
            const insertAt = idx + 1;
            const nextRoot = insertNodeAtPath(state.rootScript, parentArrayPath, insertAt, pasted);

            return {
                rootScript: nextRoot,
                selectedNodePath: [...parentArrayPath, insertAt],
                selectedNodeIndex:
                    parentArrayPath.length === state.scopePath.length &&
                    parentArrayPath.every((v, i) => v === state.scopePath[i])
                        ? insertAt
                        : state.selectedNodeIndex,
                past: [...state.past, state.rootScript].slice(-MAX_HISTORY),
                future: [],
            };
        }),

    deleteNodesByPaths: (paths) =>
        set((state) => {
            const rootIndices = paths
                .filter((p) => p.length === 1 && typeof p[0] === 'number')
                .map((p) => p[0] as number)
                .filter((i, idx, arr) => arr.indexOf(i) === idx)
                .sort((a, b) => b - a);

            if (rootIndices.length === 0) return {};

            const nextRoot = [...state.rootScript];
            for (const i of rootIndices) {
                if (i >= 0 && i < nextRoot.length) nextRoot.splice(i, 1);
            }

            return {
                rootScript: nextRoot,
                selectedNodeIndex: null,
                selectedNodePath: null,
                scopePath: [],
                past: [...state.past, state.rootScript].slice(-MAX_HISTORY),
                future: [],
            };
        }),

    duplicateNodesByPaths: (paths) =>
        set((state) => {
            const indices = paths
                .filter(isRootIndexPath)
                .map((p) => p[0])
                .filter((i, idx, arr) => arr.indexOf(i) === idx)
                .sort((a, b) => a - b);

            if (indices.length === 0) return {};

            const nextRoot = [...state.rootScript];
            const selectedCopies: ScriptPath[] = [];

            let inserted = 0;
            for (const idx of indices) {
                const sourceIndex = idx + inserted;
                const source = nextRoot[sourceIndex];
                if (source === undefined) continue;

                const copy = deepClone(source);
                const insertAt = sourceIndex + 1;
                nextRoot.splice(insertAt, 0, copy);
                selectedCopies.push([insertAt]);
                inserted += 1;
            }

            const last = selectedCopies[selectedCopies.length - 1] ?? null;

            return {
                rootScript: nextRoot,
                selectedNodePath: last,
                selectedNodeIndex: last ? (last[0] as number) : null,
                past: [...state.past, state.rootScript].slice(-MAX_HISTORY),
                future: [],
            };
        }),

    moveNodesByPathsToArray: (paths, targetArrayPath, targetIndex) =>
        set((state) => {
            const isRootTarget = targetArrayPath.length === 0;
            const rootIndices = paths
                .filter((p) => p.length === 1 && typeof p[0] === 'number')
                .map((p) => p[0] as number)
                .filter((v, i, a) => a.indexOf(v) === i)
                .sort((a, b) => a - b);

            if (!isRootTarget || rootIndices.length <= 1) return {};

            const first = rootIndices[0];
            const last = rootIndices[rootIndices.length - 1];
            const dropInsideBlock = targetIndex >= first && targetIndex <= last + 1;
            if (dropInsideBlock) return {};

            const root = [...state.rootScript];
            const movingNodes = rootIndices.map((i) => root[i]).filter((n) => n !== undefined);
            if (movingNodes.length === 0) return {};

            for (let i = rootIndices.length - 1; i >= 0; i--) root.splice(rootIndices[i], 1);

            const removedBefore = rootIndices.filter((i) => i < targetIndex).length;
            let insertAt = targetIndex - removedBefore;
            if (insertAt < 0) insertAt = 0;
            if (insertAt > root.length) insertAt = root.length;

            root.splice(insertAt, 0, ...movingNodes);

            const selectedPaths: ScriptPath[] = movingNodes.map((_, i) => [insertAt + i]);
            const lastSelected = selectedPaths[selectedPaths.length - 1] ?? null;

            useEditorStore.getState().setSelectedNodePaths(selectedPaths);
            useEditorStore.getState().setSelectionAnchorPath(selectedPaths[0] ?? null);

            return {
                rootScript: root,
                selectedNodePath: lastSelected,
                selectedNodeIndex: lastSelected ? (lastSelected[0] as number) : null,
                past: [...state.past, state.rootScript].slice(-MAX_HISTORY),
                future: [],
            };
        }),
});