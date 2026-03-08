import { create } from 'zustand';
import { createProjectIoSlice } from './project/slices/ioSlice';
import { createProjectManifestSlice } from './project/slices/manifestSlice';
import { createProjectSessionSlice } from './project/slices/sessionSlice';
import { createProjectMacrosSlice } from './project/slices/macrosSlice';
import type { ProjectState } from './project/types';

export type { MacroEntry } from './project/types';


export const useProjectStore = create<ProjectState>()((set, get) => ({
    ...createProjectSessionSlice(set),
    ...createProjectMacrosSlice(set, get),
    ...createProjectManifestSlice(set, get),
    ...createProjectIoSlice(get),

}));