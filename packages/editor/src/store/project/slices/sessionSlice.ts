import type { FsDirEntry } from '../../../services/fs';
import type { EditorNode } from '../../../types/EditorNode';
import type { ProjectScriptBridge, ProjectSessionSlice, ProjectSet } from '../types';

export function createProjectSessionSlice(set: ProjectSet, scriptBridge: ProjectScriptBridge): ProjectSessionSlice {
    return {
        activeFile: null,
        bumpTreeRevision: () => set((s) => ({ treeRevision: s.treeRevision + 1 })),
        files: [],
        projectPath: null,

        setActiveFile: (file: string, content: EditorNode[]) => {
            set({ activeFile: file });
            scriptBridge.setScript(content);
        },

        setProject: (path: string, files: FsDirEntry[]) =>
            set({
                activeFile: null,
                activeMacroName: null,
                characters: {},
                editingAllMacrosFile: false,
                files,
                items: {},
                macroEntries: [],
                macros: {},
                manifest: null,
                projectPath: path,
                scenes: {},
            }),

        treeRevision: 0,
    };
}

