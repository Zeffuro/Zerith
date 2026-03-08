import type { ScriptState, ScriptStoreCreator } from '../types';

type SelectionSlice = Pick<
    ScriptState,
    | 'popScope'
    | 'pushScope'
    | 'resetScope'
    | 'scopePath'
    | 'selectedNodeIndex'
    | 'selectedNodePath'
    | 'setSelectedNode'
    | 'setSelectedNodePath'
>;

export const createSelectionSlice: ScriptStoreCreator<SelectionSlice> = (set, get) => ({
    popScope: () =>
        set((state) => {
            const newPath = [...state.scopePath];
            newPath.pop();
            newPath.pop();
            return { scopePath: newPath, selectedNodeIndex: null, selectedNodePath: null };
        }),
    pushScope: (index, branch) =>
        set((state) => ({
            scopePath: [...state.scopePath, index, branch],
            selectedNodeIndex: null,
            selectedNodePath: null,
        })),
    resetScope: () =>
        set({ scopePath: [], selectedNodeIndex: null, selectedNodePath: null }),

    scopePath: [],

    selectedNodeIndex: null,

    selectedNodePath: null,

    setSelectedNode: (index) =>
        set((state) => ({
            selectedNodeIndex: index,
            selectedNodePath: index === null ? null : [...state.scopePath, index],
        })),

    setSelectedNodePath: (path) =>
        set(() => ({
            selectedNodeIndex:
                path &&
                path.length === get().scopePath.length + 1 &&
                get().scopePath.every((v, index) => v === path[index]) &&
                typeof path.at(-1) === 'number'
                    ? (path.at(-1) as number)
                    : null,
            selectedNodePath: path ? [...path] : null,
        })),
});