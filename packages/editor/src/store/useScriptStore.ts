import { create } from 'zustand';
import type { ScriptState } from './script/types';

import { createHistorySlice } from './script/slices/historySlice';
import { createRootScriptSlice } from './script/slices/rootScriptSlice';
import { createSelectionSlice } from './script/slices/selectionSlice';
import { createPathOpsSlice } from './script/slices/pathOpsSlice';
import { createListOpsSlice } from './script/slices/listOpsSlice';

export const useScriptStore = create<ScriptState>((set, get) => ({
    ...createRootScriptSlice(set, get),

    ...createSelectionSlice(set, get),
    ...createHistorySlice(set, get),
    ...createPathOpsSlice(set, get),
    ...createListOpsSlice(set, get),
}));