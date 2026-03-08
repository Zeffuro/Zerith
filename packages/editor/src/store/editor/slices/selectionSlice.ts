import type { ScriptPath } from '../../../utils/scriptPathUtils';
import type { DeleteRequestSource, EditorSet, SelectionSlice } from '../types';

export function createSelectionSlice(set: EditorSet): SelectionSlice {
    return {
        selectedNodePaths: [],
        selectionAnchorPath: null,
        pendingDeleteRequest: null,

        setSelectedNodePaths: (paths) =>
            set({
                selectedNodePaths: Array.from(
                    new Map(paths.map((p) => [p.join('.'), [...p] as ScriptPath])).values()
                ),
            }),

        setSelectionAnchorPath: (path) =>
            set({ selectionAnchorPath: path ? ([...path] as ScriptPath) : null }),

        clearSelection: () =>
            set({ selectedNodePaths: [], selectionAnchorPath: null }),

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

        requestDelete: (paths, source: DeleteRequestSource = 'keyboard') =>
            set({ pendingDeleteRequest: { paths, source } }),

        clearDeleteRequest: () =>
            set({ pendingDeleteRequest: null }),
    };
}

