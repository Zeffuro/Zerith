import type { FsDirectoryEntry } from '../../../services/fs';
import type { EditorNode } from '../../../types/EditorNode';
import type { ProjectScriptBridge, ProjectSessionSlice, ProjectSet } from '../types';

export function createProjectSessionSlice(set: ProjectSet, scriptBridge: ProjectScriptBridge): ProjectSessionSlice {
    return {
        activeFile: undefined,
        bumpTreeRevision: () => set((s) => ({ treeRevision: s.treeRevision + 1 })),
        expandedPaths: [],
        expandToPath: (targetPath: string) =>
            set((state) => {
                const normalized = targetPath.replaceAll('\\', '/');
                const pieces = normalized.split('/').filter((piece) => piece.length > 0);

                if (pieces.length <= 1) return {};

                const nextExpanded = new Set(state.expandedPaths);
                const prefix = normalized.startsWith('/') ? '/' : '';

                for (let index = 0; index < pieces.length - 1; index += 1) {
                    const candidate = `${prefix}${pieces.slice(0, index + 1).join('/')}`;
                    nextExpanded.add(candidate);
                }

                const expandedPaths = [...nextExpanded];
                if (expandedPaths.length === state.expandedPaths.length) return {};
                return { expandedPaths };
            }),
        files: [],
        projectPath: undefined,

        setActiveFile: (file: string, content: EditorNode[]) => {
            set({ activeFile: file });
            scriptBridge.setScript(content);
        },

        setPathExpanded: (path: string, expanded: boolean) =>
            set((state) => {
                const hasPath = state.expandedPaths.includes(path);
                if (expanded && !hasPath) {
                    return { expandedPaths: [...state.expandedPaths, path] };
                }

                if (!expanded && hasPath) {
                    return { expandedPaths: state.expandedPaths.filter((expandedPath) => expandedPath !== path) };
                }

                return {};
            }),


        setProject: (path: string, files: FsDirectoryEntry[]) =>
            set({
                activeFile: undefined,
                activeMacroName: undefined,
                characters: {},
                editingAllMacrosFile: false,
                expandedPaths: [],
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
