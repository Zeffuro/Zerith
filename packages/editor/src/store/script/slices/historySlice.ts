import type { ScriptSlice } from '../types';

import { MAX_HISTORY } from '../constants';

type HistorySlice = Pick<
    import('../types').ScriptState,
    'canRedo' | 'canUndo' | 'future' | 'past' | 'redo' | 'undo'
>;

export const createHistorySlice: ScriptSlice<HistorySlice> = (set, get) => ({
    canRedo: () => get().future.length > 0,
    canUndo: () => get().past.length > 0,

    future: [],
    past: [],

    redo: () =>
        set((state) => {
            if (state.future.length === 0) return {};
            const next = state.future[0];
            return {
                future: state.future.slice(1),
                past: [...state.past, state.rootScript].slice(-MAX_HISTORY),
                rootScript: next,
                scopePath: [],
                selectedNodeIndex: undefined,
                selectedNodePath: undefined,
            };
        }),

    undo: () =>
        set((state) => {
            if (state.past.length === 0) return {};
            const previous = state.past.at(-1);
            return {
                future: [state.rootScript, ...state.future],
                past: state.past.slice(0, -1),
                rootScript: previous,
                scopePath: [],
                selectedNodeIndex: undefined,
                selectedNodePath: undefined,
            };
        }),
});