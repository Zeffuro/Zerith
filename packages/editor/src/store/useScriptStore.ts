import { create } from 'zustand';

import type { ScriptState } from './script/types';

import { getPathOpsProjectBridge } from './script/bridges/pathOpsProjectBridge';
import { createHistorySlice } from './script/slices/historySlice';
import { createListOpsSlice } from './script/slices/listOpsSlice';
import { createPathOpsSlice } from './script/slices/pathOpsSlice';
import { createRootScriptSlice } from './script/slices/rootScriptSlice';
import { createSelectionSlice } from './script/slices/selectionSlice';

export const useScriptStore = create<ScriptState>((set, get) => ({
    ...createRootScriptSlice(set, get),

    ...createSelectionSlice(set, get),
    ...createHistorySlice(set, get),
    ...createPathOpsSlice(set, get, getPathOpsProjectBridge),
    ...createListOpsSlice(set, get),
}));