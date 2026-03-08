import type { FsDirectoryEntry } from '../../../services/fs';
import type { EditorNode } from '../../../types/EditorNode';
import type { ProjectScriptBridge, ProjectSessionSlice, ProjectSet } from '../types';

export function createProjectSessionSlice(set: ProjectSet, scriptBridge: ProjectScriptBridge): ProjectSessionSlice {
    return {
        activeFile: undefined,
        bumpTreeRevision: () => set((s) => ({ treeRevision: s.treeRevision + 1 })),
        files: [],
        projectPath: undefined,

        setActiveFile: (file: string, content: EditorNode[]) => {
            set({ activeFile: file });
            scriptBridge.setScript(content);
        },

        setProject: (path: string, files: FsDirectoryEntry[]) =>
            set({
                activeFile: undefined,
                activeMacroName: undefined,
                characters: {},
                editingAllMacrosFile: false,
                files,
                items: {},
                macroEntries: [],
                macros: {},
                manifest: undefined,
                projectPath: path,
                scenes: {},
                treeRevision: 0,
            }),

        setProjectFiles: (files: FsDirectoryEntry[]) =>
            set((state) => ({
                files,
                treeRevision: state.treeRevision + 1,
            })),

        treeRevision: 0,
    };
}
