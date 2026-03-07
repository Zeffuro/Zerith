import { create } from 'zustand';
import { normalizeScript } from './script/helpers';
import type { ScriptState } from './script/types';

import { createHistorySlice } from './script/slices/historySlice';
import { createSelectionSlice } from './script/slices/selectionSlice';
import { createPathOpsSlice } from './script/slices/pathOpsSlice';
import { createListOpsSlice } from './script/slices/listOpsSlice';

export const useScriptStore = create<ScriptState>((set, get) => ({
    rootScript: [],

    ...createSelectionSlice(set, get),
    ...createHistorySlice(set, get),
    ...createPathOpsSlice(set, get),
    ...createListOpsSlice(set, get),

    setScript: (script) =>
        set({
            rootScript: normalizeScript(script),
            scopePath: [],
            selectedNodeIndex: null,
            selectedNodePath: null,
            past: [],
            future: [],
        }),
}));