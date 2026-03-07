import type { ScriptStoreCreator, ScriptState } from '../types';

type SelectionSlice = Pick<
    ScriptState,
    | 'scopePath'
    | 'selectedNodeIndex'
    | 'selectedNodePath'
    | 'pushScope'
    | 'popScope'
    | 'resetScope'
    | 'setSelectedNode'
    | 'setSelectedNodePath'
>;

export const createSelectionSlice: ScriptStoreCreator<SelectionSlice> = (set, get) => ({
    scopePath: [],
    selectedNodeIndex: null,
    selectedNodePath: null,

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

    resetScope: () =>
        set({ scopePath: [], selectedNodeIndex: null, selectedNodePath: null }),

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
});