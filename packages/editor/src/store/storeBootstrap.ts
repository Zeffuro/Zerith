import { create } from 'zustand';

import type { ProjectState } from './project/types';
import type { ScriptState } from './script/types';

import { referenceScannerInputsChanged, referenceScanOwnership } from '../services/referenceScanner/ownership';
import { createProjectIoSlice } from './project/slices/ioSlice';
import { createProjectMacrosSlice } from './project/slices/macrosSlice';
import { createProjectManifestSlice } from './project/slices/manifestSlice';
import { createProjectSessionSlice } from './project/slices/sessionSlice';
import { createHistorySlice } from './script/slices/historySlice';
import { createListOpsSlice } from './script/slices/listOpsSlice';
import { createPathOpsSlice } from './script/slices/pathOpsSlice';
import { createRootScriptSlice } from './script/slices/rootScriptSlice';
import { createSelectionSlice } from './script/slices/selectionSlice';
import { useReferenceStore } from './useReferenceStore';

function getScriptStoreState(): ScriptState {
    return useScriptStore.getState();
}

export const useProjectStore = create<ProjectState>()((set, get) => ({
    ...createProjectSessionSlice(set, get, {
        getRootScript: () => getScriptStoreState().rootScript,
        setScript: (content) => getScriptStoreState().setScript(content),
    }),
    ...createProjectMacrosSlice(set, get),
    ...createProjectManifestSlice(set, get),
    ...createProjectIoSlice(get, {
        getRootScript: () => getScriptStoreState().rootScript,
        setScript: (content) => getScriptStoreState().setScript(content),
    }),
}));

export const useScriptStore = create<ScriptState>((set, get) => ({
    ...createRootScriptSlice(set, get),

    ...createSelectionSlice(set, get),
    ...createHistorySlice(set, get),
    ...createPathOpsSlice(set, get, () => useProjectStore.getState()),
    ...createListOpsSlice(set, get),
}));

useProjectStore.subscribe((current, previous) => {
    if (referenceScannerInputsChanged(current, previous)) referenceScanOwnership.invalidate();
    if (current.projectPath !== previous.projectPath || current.projectGeneration !== previous.projectGeneration) {
        useReferenceStore.getState().clearSnapshot();
    }
});


