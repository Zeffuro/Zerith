import type { CharacterDefinition, Command, GameManifest, ItemManifestEntry, LocaleBundle, Script } from 'core';

import type { FsDirectoryEntry } from '../../services/fs';
import type { EditorNode } from '../../types/EditorNode';

export type MacroEntry = { commands: Command[]; name: string; };

export type ProjectGet = () => ProjectState;

export interface ProjectIoSlice {
    openProjectFromManifest: (manifestPath: string) => Promise<void>;
    saveActiveFileFromCurrentScript: () => Promise<void>;
    saveAllDirtyFiles: () => Promise<SaveAllResult>;
}


export interface ProjectMacrosSlice {
    activeMacroName: string | undefined;
    addMacroEntry: (name?: string) => void;
    deleteMacroEntries: (indices: number[]) => void;
    duplicateMacroEntries: (indices: number[]) => void;
    editingAllMacrosFile: boolean;
    macroEntries: MacroEntry[];
    moveMacroEntries: (fromIndices: number[], targetIndex: number) => void;
    removeMacroEntry: (index: number) => void;
    renameMacroEntry: (index: number, nextName: string) => void;
    saveActiveMacroFromScript: (script: Command[]) => void;
    setActiveMacroName: (name: string | undefined) => void;
    setEditingAllMacrosFile: (v: boolean) => void;
    setMacroEntries: (entries: MacroEntry[]) => void;
    updateMacroCommands: (index: number, commands: Command[]) => void;
}

export interface ProjectManifestSlice {
    characters: Record<string, CharacterDefinition>;
    items: Record<string, ItemManifestEntry>;
    loadManifest: () => Promise<void>;
    localePaths: Record<string, string | undefined>;
    locales: Record<string, LocaleBundle>;
    macros: Record<string, Script>;
    manifest: GameManifest | undefined;
    sceneNamespaces: Record<string, string | undefined>;
    scenePaths: Record<string, string | undefined>;
    scenes: Record<string, Script>;
}

export interface ProjectScriptBridge {
    getRootScript: () => EditorNode[];
    setScript: (content: EditorNode[]) => void;
}

export interface ProjectSessionSlice {
    activeFile: string | undefined;
    bumpTreeRevision: () => void;
    clearActiveFile: () => void;
    clearAllDirtyFiles: () => void;
    clearFileDirty: (filePath: string) => void;
    dirtyFiles: Set<string>;
    expandedPaths: string[];
    expandToPath: (targetPath: string) => void;
    files: FsDirectoryEntry[];
    isFileDirty: (filePath: string) => boolean;
    markFileDirty: (filePath: string) => void;
    projectPath: string | undefined;
    setActiveFile: (file: string, content: EditorNode[]) => void;
    setPathExpanded: (path: string, expanded: boolean) => void;
    setProject: (path: string | undefined, files: FsDirectoryEntry[]) => void;
    setProjectFiles: (files: FsDirectoryEntry[]) => void;
    treeRevision: number;
}

export type ProjectSet = (
    partial: ((state: ProjectState) => Partial<ProjectState>) | Partial<ProjectState>
) => void;

export interface ProjectState extends ProjectIoSlice, ProjectMacrosSlice, ProjectManifestSlice, ProjectSessionSlice {}

export type SaveAllResult = {
    failed: string[];
    saved: string[];
    skipped: string[];
};
