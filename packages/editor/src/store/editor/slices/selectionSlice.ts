import type { ScriptPath } from '../../../utils/scriptPathUtilities';
import type { DeleteRequestSource, EditorSet, SelectionSlice } from '../types';

export function createSelectionSlice(set: EditorSet): SelectionSlice {
    return {
        clearDeleteRequest: () =>
            set({ pendingDeleteRequest: undefined }),
        clearSelection: () =>
            set({ selectedNodePaths: [], selectionAnchorPath: undefined }),
        pendingDeleteRequest: undefined,

        requestDelete: (paths, source: DeleteRequestSource = 'keyboard') =>
            set({ pendingDeleteRequest: { paths, source } }),

        selectedNodePaths: [],

        selectionAnchorPath: undefined,

        setSelectedNodePaths: (paths) =>
            set({
                selectedNodePaths: [...new Map(paths.map((p) => [p.join('.'), [...p] as ScriptPath])).values()],
            }),

        setSelectionAnchorPath: (path) =>
            set({ selectionAnchorPath: path ? ([...path] as ScriptPath) : undefined }),

        toggleSelectedNodePath: (path) =>
            set((state) => {
                const key = path.join('.');
                const exists = Array.isArray(state.selectedNodePaths)
                    && state.selectedNodePaths.some((p: ScriptPath) => p.join('.') === key);
                return {
                    selectedNodePaths: exists
                        ? state.selectedNodePaths.filter((p: ScriptPath) => p.join('.') !== key)
                        : [...state.selectedNodePaths, [...path] as ScriptPath],
                };
            }),
    };
}


