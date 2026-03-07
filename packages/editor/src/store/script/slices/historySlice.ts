import { MAX_HISTORY } from '../constants';
import type { ScriptStoreCreator } from '../types';

type HistorySlice = Pick<
    import('../types').ScriptState,
    'past' | 'future' | 'canUndo' | 'canRedo' | 'undo' | 'redo'
>;

export const createHistorySlice: ScriptStoreCreator<HistorySlice> = (set, get) => ({
    past: [],
    future: [],

    canUndo: () => get().past.length > 0,
    canRedo: () => get().future.length > 0,

    undo: () =>
        set((state) => {
            if (state.past.length === 0) return {};
            const previous = state.past[state.past.length - 1];
            return {
                rootScript: previous,
                past: state.past.slice(0, -1),
                future: [state.rootScript, ...state.future],
                selectedNodeIndex: null,
                selectedNodePath: null,
                scopePath: [],
            };
        }),

    redo: () =>
        set((state) => {
            if (state.future.length === 0) return {};
            const next = state.future[0];
            return {
                rootScript: next,
                past: [...state.past, state.rootScript].slice(-MAX_HISTORY),
                future: state.future.slice(1),
                selectedNodeIndex: null,
                selectedNodePath: null,
                scopePath: [],
            };
        }),
});