import type { FsDirEntry } from '../../../services/fs';
import type { EditorNode } from '../../../types/EditorNode';
import { useScriptStore } from '../../useScriptStore';
import type { ProjectSessionSlice, ProjectSet } from '../types';

export function createProjectSessionSlice(set: ProjectSet): ProjectSessionSlice {
    return {
        projectPath: null,
        files: [],
        activeFile: null,
        treeRevision: 0,

        setProject: (path: string, files: FsDirEntry[]) =>
            set({
                projectPath: path,
                files,
                activeFile: null,
                manifest: null,
                characters: {},
                items: {},
                macros: {},
                scenes: {},
                activeMacroName: null,
                editingAllMacrosFile: false,
                macroEntries: [],
            }),

        setActiveFile: (file: string, content: EditorNode[]) => {
            set({ activeFile: file });
            useScriptStore.getState().setScript(content);
        },

        bumpTreeRevision: () => set((s) => ({ treeRevision: s.treeRevision + 1 })),
    };
}

