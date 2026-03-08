import { create } from 'zustand';
import { createProjectIoSlice } from './project/slices/ioSlice';
import { createProjectManifestSlice } from './project/slices/manifestSlice';
import { createProjectSessionSlice } from './project/slices/sessionSlice';
import { createProjectMacrosSlice } from './project/slices/macrosSlice';
import type { ProjectState } from './project/types';
import { useScriptStore } from './useScriptStore';
import { setPathOpsProjectBridge } from './script/bridges/pathOpsProjectBridge';

export type { MacroEntry } from './project/types';


export const useProjectStore = create<ProjectState>()((set, get) => ({
    ...createProjectSessionSlice(set, {
        setScript: (content) => useScriptStore.getState().setScript(content),
        getRootScript: () => useScriptStore.getState().rootScript,
    }),
    ...createProjectMacrosSlice(set, get),
    ...createProjectManifestSlice(set, get),
    ...createProjectIoSlice(get, {
        setScript: (content) => useScriptStore.getState().setScript(content),
        getRootScript: () => useScriptStore.getState().rootScript,
    }),

}));

setPathOpsProjectBridge(() => useProjectStore.getState());
