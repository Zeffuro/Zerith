import type { ScriptPath } from '../../../utils/scriptPathUtils';
import type { DeleteRequestSource, EditorSet, SelectionSlice } from '../types';

export function createSelectionSlice(set: EditorSet): SelectionSlice {
    return {
        clearDeleteRequest: () =>
            set({ pendingDeleteRequest: null }),
        clearSelection: () =>
            set({ selectedNodePaths: [], selectionAnchorPath: null }),
        pendingDeleteRequest: null,

        requestDelete: (paths, source: DeleteRequestSource = 'keyboard') =>
            set({ pendingDeleteRequest: { paths, source } }),

        selectedNodePaths: [],

        selectionAnchorPath: null,

        setSelectedNodePaths: (paths) =>
            set({
                selectedNodePaths: [...new Map(paths.map((p) => [p.join('.'), [...p] as ScriptPath])).values()],
            }),

        setSelectionAnchorPath: (path) =>
            set({ selectionAnchorPath: path ? ([...path] as ScriptPath) : null }),

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

