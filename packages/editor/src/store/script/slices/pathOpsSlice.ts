import type { EditorNode } from '../../../types/EditorNode';
import type { PathOpsProjectBridge } from '../bridges/pathOpsProjectBridge';
import type { ScriptGet, ScriptSet, ScriptState } from '../types';

import {
    getAtPath,
    getNodeIndex,
    getParentArrayPath,
    insertNodeAtPath,
    moveNodeByPath as moveNodeByPathUtility,
    removeNodeAtPath,
    type ScriptPath,
    setAtPath,
} from '../../../utils/scriptPathUtils';
import { MAX_HISTORY } from '../constants';
import { deepClone, isRootIndexPath } from '../helpers';

type PathOpsSlice = Pick<
    ScriptState,
    | 'addNodeAtPath'
    | 'deleteNodeByPath'
    | 'deleteNodesByPaths'
    | 'duplicateNodeByPath'
    | 'duplicateNodesByPaths'
    | 'getNodeAtPath'
    | 'moveNodeByPath'
    | 'moveNodesByPathsToArray'
    | 'moveTimelineNode'
    | 'moveTimelineNodesToArray'
    | 'pasteNodeAtPath'
    | 'updateNodeAtPath'
>;

const isRootNodePath = (p: ScriptPath) => p.length === 1 && typeof p[0] === 'number';

export const createPathOpsSlice = (
    set: ScriptSet,
    get: ScriptGet,
    getProjectBridge: () => null | PathOpsProjectBridge,
): PathOpsSlice => ({
    addNodeAtPath: (arrayPath, node, index) =>
        set((state) => {
            const array = getAtPath<EditorNode[]>(state.rootScript, arrayPath);
            if (!Array.isArray(array)) return {};
            const at = index === undefined ? array.length : index;
            const nextRoot = insertNodeAtPath(state.rootScript, arrayPath, at, node);
            return {
                future: [],
                past: [...state.past, state.rootScript].slice(-MAX_HISTORY),
                rootScript: nextRoot,
                selectedNodePath: [...arrayPath, Math.max(0, Math.min(at, array.length))],
            };
        }),

    deleteNodeByPath: (nodePath) =>
        set((state) => {
            const [nextRoot] = removeNodeAtPath(state.rootScript, nodePath);
            const selected = state.selectedNodePath;
            const isSameSelected =
                selected &&
                selected.length === nodePath.length &&
                selected.every((v, index) => v === nodePath[index]);

            return {
                future: [],
                past: [...state.past, state.rootScript].slice(-MAX_HISTORY),
                rootScript: nextRoot,
                selectedNodePath: isSameSelected ? null : selected,
            };
        }),

    deleteNodesByPaths: (paths) =>
        set((state) => {
            const rootIndices = paths
                .filter((p) => p.length === 1 && typeof p[0] === 'number')
                .map((p) => p[0] as number)
                .filter((index, index_, array) => array.indexOf(index) === index_)
                .sort((a, b) => b - a);

            if (rootIndices.length === 0) return {};

            const nextRoot = [...state.rootScript];
            for (const index of rootIndices) {
                if (index >= 0 && index < nextRoot.length) nextRoot.splice(index, 1);
            }

            return {
                future: [],
                past: [...state.past, state.rootScript].slice(-MAX_HISTORY),
                rootScript: nextRoot,
                scopePath: [],
                selectedNodeIndex: null,
                selectedNodePath: null,
            };
        }),

    duplicateNodeByPath: (nodePath) =>
        set((state) => {
            const node = getAtPath<EditorNode>(state.rootScript, nodePath);
            if (node === undefined) return {};

            const parentArrayPath = getParentArrayPath(nodePath);
            const index = getNodeIndex(nodePath);
            const parentArray = getAtPath<EditorNode[]>(state.rootScript, parentArrayPath);
            if (!Array.isArray(parentArray)) return {};

            const duplicated = deepClone(node);
            const insertAt = index + 1;
            const nextRoot = insertNodeAtPath(state.rootScript, parentArrayPath, insertAt, duplicated);

            return {
                future: [],
                past: [...state.past, state.rootScript].slice(-MAX_HISTORY),
                rootScript: nextRoot,
                selectedNodeIndex:
                    parentArrayPath.length === state.scopePath.length &&
                    parentArrayPath.every((v, index_) => v === state.scopePath[index_])
                        ? insertAt
                        : state.selectedNodeIndex,
                selectedNodePath: [...parentArrayPath, insertAt],
            };
        }),

    duplicateNodesByPaths: (paths) =>
        set((state) => {
            const indices = paths
                .filter(isRootIndexPath)
                .map((p) => p[0])
                .filter((index, index_, array) => array.indexOf(index) === index_)
                .sort((a, b) => a - b);

            if (indices.length === 0) return {};

            const nextRoot = [...state.rootScript];
            const selectedCopies: ScriptPath[] = [];

            let inserted = 0;
            for (const index of indices) {
                const sourceIndex = index + inserted;
                const source = nextRoot[sourceIndex];
                if (source === undefined) continue;

                const copy = deepClone(source);
                const insertAt = sourceIndex + 1;
                nextRoot.splice(insertAt, 0, copy);
                selectedCopies.push([insertAt]);
                inserted += 1;
            }

            const last = selectedCopies.at(-1) ?? null;

            return {
                future: [],
                past: [...state.past, state.rootScript].slice(-MAX_HISTORY),
                rootScript: nextRoot,
                selectedNodeIndex: last ? (last[0] as number) : null,
                selectedNodePath: last,
            };
        }),

    getNodeAtPath: (path) => {
        const { rootScript } = get();
        return getAtPath(rootScript, path);
    },

    moveNodeByPath: (sourceNodePath, targetArrayPath, targetIndex) =>
        set((state) => {
            const nextRoot = moveNodeByPathUtility(state.rootScript, sourceNodePath, targetArrayPath, targetIndex);

            const selected = state.selectedNodePath;
            let nextSelected = selected;

            if (
                selected &&
                selected.length === sourceNodePath.length &&
                selected.every((v, index) => v === sourceNodePath[index])
            ) {
                const sourceParent = getParentArrayPath(sourceNodePath);
                const sourceIndex = getNodeIndex(sourceNodePath);
                const sameParent =
                    sourceParent.length === targetArrayPath.length &&
                    sourceParent.every((v, index) => v === targetArrayPath[index]);
                const adjustedIndex = sameParent && sourceIndex < targetIndex ? targetIndex - 1 : targetIndex;
                nextSelected = [...targetArrayPath, adjustedIndex];
            }

            return {
                future: [],
                past: [...state.past, state.rootScript].slice(-MAX_HISTORY),
                rootScript: nextRoot,
                selectedNodePath: nextSelected,
            };
        }),

    moveNodesByPathsToArray: (paths, targetArrayPath, targetIndex) =>
        set((state) => {
            const isRootTarget = targetArrayPath.length === 0;
            const rootIndices = paths
                .filter((p) => p.length === 1 && typeof p[0] === 'number')
                .map((p) => p[0] as number)
                .filter((v, index, a) => a.indexOf(v) === index)
                .sort((a, b) => a - b);

            if (!isRootTarget || rootIndices.length <= 1) return {};

            const first = rootIndices[0];
            const last = rootIndices.at(-1);
            const dropInsideBlock = targetIndex >= first && targetIndex <= last + 1;
            if (dropInsideBlock) return {};

            const root = [...state.rootScript];
            const movingNodes = rootIndices.map((index) => root[index]).filter((n) => n !== undefined);
            if (movingNodes.length === 0) return {};

            for (let index = rootIndices.length - 1; index >= 0; index--) root.splice(rootIndices[index], 1);

            const removedBefore = rootIndices.filter((index) => index < targetIndex).length;
            let insertAt = targetIndex - removedBefore;
            if (insertAt < 0) insertAt = 0;
            if (insertAt > root.length) insertAt = root.length;

            root.splice(insertAt, 0, ...movingNodes);

            const selectedPaths: ScriptPath[] = movingNodes.map((_, index) => [insertAt + index]);
            const lastSelected = selectedPaths.at(-1) ?? null;

            return {
                future: [],
                past: [...state.past, state.rootScript].slice(-MAX_HISTORY),
                rootScript: root,
                selectedNodeIndex: lastSelected ? (lastSelected[0] as number) : null,
                selectedNodePath: lastSelected,
            };
        }),

    moveTimelineNode: (sourceNodePath, targetArrayPath, targetIndex) => {
        const project = getProjectBridge();

        if (!project || !project.editingAllMacrosFile) {
            get().moveNodeByPath(sourceNodePath, targetArrayPath, targetIndex);
            return;
        }

        if (isRootNodePath(sourceNodePath) && targetArrayPath.length === 0) {
            project.moveMacroEntries([sourceNodePath[0] as number], targetIndex);
            return;
        }

        if (sourceNodePath.length <= 1) return;

        const sourceMacroIndex = sourceNodePath[0];
        const targetMacroIndex = targetArrayPath[0];
        if (typeof sourceMacroIndex !== 'number' || typeof targetMacroIndex !== 'number') return;
        if (sourceMacroIndex !== targetMacroIndex) return;

        const macro = project.macroEntries[sourceMacroIndex];
        if (!macro) return;

        const sourceRest = sourceNodePath.slice(1);
        const targetRest = targetArrayPath.slice(1);
        if (sourceRest[0] !== 'body' || targetRest[0] !== 'body') return;

        const sourcePathInCommands = sourceRest.slice(1);
        const targetArrayPathInCommands = targetRest.slice(1);
        if (sourcePathInCommands.length === 0) return;

        const movedCommands = moveNodeByPathUtility(
            macro.commands,
            sourcePathInCommands,
            targetArrayPathInCommands,
            targetIndex
        );

        project.updateMacroCommands(sourceMacroIndex, movedCommands);
    },

    moveTimelineNodesToArray: (paths, targetArrayPath, targetIndex) => {
        const project = getProjectBridge();

        if (!project || !project.editingAllMacrosFile) {
            get().moveNodesByPathsToArray(paths, targetArrayPath, targetIndex);
            return;
        }

        if (targetArrayPath.length > 0) return;

        const from = paths
            .filter(isRootNodePath)
            .map((p) => p[0] as number);

        if (from.length <= 1) return;
        project.moveMacroEntries(from, targetIndex);
    },

    pasteNodeAtPath: (targetNodePath, node) =>
        set((state) => {
            const parentArrayPath = getParentArrayPath(targetNodePath);
            const index = getNodeIndex(targetNodePath);
            const parentArray = getAtPath<EditorNode[]>(state.rootScript, parentArrayPath);
            if (!Array.isArray(parentArray)) return {};

            const pasted = deepClone(node);
            const insertAt = index + 1;
            const nextRoot = insertNodeAtPath(state.rootScript, parentArrayPath, insertAt, pasted);

            return {
                future: [],
                past: [...state.past, state.rootScript].slice(-MAX_HISTORY),
                rootScript: nextRoot,
                selectedNodeIndex:
                    parentArrayPath.length === state.scopePath.length &&
                    parentArrayPath.every((v, index_) => v === state.scopePath[index_])
                        ? insertAt
                        : state.selectedNodeIndex,
                selectedNodePath: [...parentArrayPath, insertAt],
            };
        }),

    updateNodeAtPath: (path, patch) =>
        set((state) => {
            const current = getAtPath<EditorNode>(state.rootScript, path);
            if (!current || typeof current !== 'object') return {};
            const updated = { ...current, ...patch };
            const nextRoot = setAtPath(state.rootScript, path, updated);
            return {
                future: [],
                past: [...state.past, state.rootScript].slice(-MAX_HISTORY),
                rootScript: nextRoot,
            };
        }),
});