import { create } from 'zustand';
import { getNestedArray, updateDeepScript } from '../utils/scriptUtils';
import {
    type ScriptPath,
    getAtPath,
    getParentArrayPath,
    getNodeIndex,
    moveNodeByPath,
    removeNodeAtPath,
    insertNodeAtPath,
    setAtPath,
} from '../utils/scriptPathUtils';

interface ScriptState {
    rootScript: any[];
    scopePath: (string | number)[];
    selectedNodeIndex: number | null;

    selectedNodePath: ScriptPath | null;

    // Actions
    setScript: (script: any[]) => void;
    getActiveScript: () => any[];

    pushScope: (index: number, branch: string) => void;
    popScope: () => void;
    resetScope: () => void;

    setSelectedNode: (index: number | null) => void;

    // Script Path Manipulation
    setSelectedNodePath: (path: ScriptPath | null) => void;
    getNodeAtPath: (path: ScriptPath) => any | undefined;
    updateNodeAtPath: (path: ScriptPath, patch: Record<string, any>) => void;
    moveNodeByPath: (sourceNodePath: ScriptPath, targetArrayPath: ScriptPath, targetIndex: number) => void;
    deleteNodeByPath: (nodePath: ScriptPath) => void;
    addNodeAtPath: (arrayPath: ScriptPath, node: any, index?: number) => void;

    // Manipulation
    updateActiveScript: (newSubArray: any[]) => void;
    moveNode: (index: number, direction: 'up' | 'down') => void;
    deleteNode: (index: number) => void;
    addNode: (node: any) => void;
}

export const useScriptStore = create<ScriptState>((set, get) => ({
    rootScript: [],
    scopePath: [],
    selectedNodeIndex: null,
    selectedNodePath: null,

    setScript: (script) =>
        set({
            rootScript: script,
            scopePath: [],
            selectedNodeIndex: null,
            selectedNodePath: null,
        }),

    getActiveScript: () => {
        const { rootScript, scopePath } = get();
        return getNestedArray(rootScript, scopePath);
    },

    pushScope: (index, branch) =>
        set((state) => ({
            scopePath: [...state.scopePath, index, branch],
            selectedNodeIndex: null,
            selectedNodePath: null,
        })),

    popScope: () =>
        set((state) => {
            const newPath = [...state.scopePath];
            newPath.pop();
            newPath.pop();
            return { scopePath: newPath, selectedNodeIndex: null, selectedNodePath: null };
        }),

    resetScope: () => set({ scopePath: [], selectedNodeIndex: null, selectedNodePath: null }),

    setSelectedNode: (index) =>
        set((state) => ({
            selectedNodeIndex: index,
            selectedNodePath: index === null ? null : [...state.scopePath, index],
        })),

    setSelectedNodePath: (path) =>
        set(() => ({
            selectedNodePath: path ? [...path] : null,
            selectedNodeIndex:
                path &&
                path.length === get().scopePath.length + 1 &&
                get().scopePath.every((v, i) => v === path[i]) &&
                typeof path[path.length - 1] === 'number'
                    ? (path[path.length - 1] as number)
                    : null,
        })),

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
            return { rootScript: nextRoot };
        }),

    moveNodeByPath: (sourceNodePath, targetArrayPath, targetIndex) =>
        set((state) => {
            const nextRoot = moveNodeByPath(state.rootScript, sourceNodePath, targetArrayPath, targetIndex);

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

            return { rootScript: nextRoot, selectedNodePath: nextSelected };
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
            };
        }),

    updateActiveScript: (newSubArray) =>
        set((state) => ({
            rootScript: updateDeepScript(state.rootScript, state.scopePath, newSubArray),
        })),

    moveNode: (index, direction) => {
        const { getActiveScript, updateActiveScript } = get();
        const currentList = getActiveScript();

        if (index === null || index < 0 || index >= currentList.length) return;
        const newIndex = direction === 'up' ? index - 1 : index + 1;
        if (newIndex < 0 || newIndex >= currentList.length) return;

        const newList = [...currentList];
        [newList[index], newList[newIndex]] = [newList[newIndex], newList[index]];
        updateActiveScript(newList);

        const scope = get().scopePath;
        set({
            selectedNodeIndex: newIndex,
            selectedNodePath: [...scope, newIndex],
        });
    },

    deleteNode: (index) => {
        const { getActiveScript, updateActiveScript, selectedNodeIndex } = get();
        const newList = getActiveScript().filter((_, i) => i !== index);

        updateActiveScript(newList);

        const nextIndex =
            selectedNodeIndex === index
                ? null
                : selectedNodeIndex !== null && selectedNodeIndex > index
                    ? selectedNodeIndex - 1
                    : selectedNodeIndex;

        const scope = get().scopePath;
        set({
            selectedNodeIndex: nextIndex,
            selectedNodePath: nextIndex === null ? null : [...scope, nextIndex],
        });
    },

    addNode: (node) => {
        const { getActiveScript, updateActiveScript, selectedNodeIndex } = get();
        const currentList = getActiveScript();

        const index = selectedNodeIndex !== null ? selectedNodeIndex + 1 : currentList.length;
        const newList = [...currentList];
        newList.splice(index, 0, node);

        updateActiveScript(newList);

        const scope = get().scopePath;
        set({
            selectedNodeIndex: index,
            selectedNodePath: [...scope, index],
        });
    },
}));