import { create } from 'zustand';

import type { ProjectState } from './project/types';

import { createProjectIoSlice } from './project/slices/ioSlice';
import { createProjectMacrosSlice } from './project/slices/macrosSlice';
import { createProjectManifestSlice } from './project/slices/manifestSlice';
import { createProjectSessionSlice } from './project/slices/sessionSlice';
import { setPathOpsProjectBridge } from './script/bridges/pathOpsProjectBridge';
import { useScriptStore } from './useScriptStore';

export type { MacroEntry } from './project/types';


export const useProjectStore = create<ProjectState>()((set, get) => ({
    ...createProjectSessionSlice(set, {
        getRootScript: () => useScriptStore.getState().rootScript,
        setScript: (content) => useScriptStore.getState().setScript(content),
    }),
    ...createProjectMacrosSlice(set, get),
    ...createProjectManifestSlice(set, get),
    ...createProjectIoSlice(get, {
        getRootScript: () => useScriptStore.getState().rootScript,
        setScript: (content) => useScriptStore.getState().setScript(content),
    }),

}));

setPathOpsProjectBridge(() => useProjectStore.getState());
