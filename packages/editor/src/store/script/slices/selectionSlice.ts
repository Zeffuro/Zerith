import type { ScriptSlice, ScriptState } from '../types';

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

export const createSelectionSlice: ScriptSlice<SelectionSlice> = (set, get) => ({
    popScope: () =>
        set((state) => {
            const newPath = [...state.scopePath];
            newPath.pop();
            newPath.pop();
            return { scopePath: newPath, selectedNodeIndex: undefined, selectedNodePath: undefined };
        }),
    pushScope: (index, branch) =>
        set((state) => ({
            scopePath: [...state.scopePath, index, branch],
            selectedNodeIndex: undefined,
            selectedNodePath: undefined,
        })),
    resetScope: () =>
        set({ scopePath: [], selectedNodeIndex: undefined, selectedNodePath: undefined }),

    scopePath: [],

    selectedNodeIndex: undefined,

    selectedNodePath: undefined,

    setSelectedNode: (index) =>
        set((state) => ({
            selectedNodeIndex: index === null ? undefined : index,
            selectedNodePath: index === null || index === undefined ? undefined : [...state.scopePath, index],
        })),

    setSelectedNodePath: (path) =>
        set(() => ({
            selectedNodeIndex:
                path &&
                path.length === get().scopePath.length + 1 &&
                get().scopePath.every((v, index) => v === path[index]) &&
                typeof path.at(-1) === 'number'
                    ? (path.at(-1) as number)
                    : undefined,
            selectedNodePath: path ? [...path] : undefined,
        })),
});