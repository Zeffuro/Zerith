import type { DirEntry } from '@tauri-apps/plugin-fs';

export type ProjectSet = (
    partial: Record<string, any> | ((state: Record<string, any>) => Record<string, any>)
) => void;

export type MacroEntry = { name: string; commands: any[] };

export interface ProjectSessionSlice {
    projectPath: string | null;
    files: DirEntry[];
    activeFile: string | null;
    treeRevision: number;
    setProject: (path: string, files: DirEntry[]) => void;
    setActiveFile: (file: string, content: any[]) => void;
    bumpTreeRevision: () => void;
}

export interface ProjectMacrosSlice {
    activeMacroName: string | null;
    editingAllMacrosFile: boolean;
    macroEntries: MacroEntry[];
    setActiveMacroName: (name: string | null) => void;
    setEditingAllMacrosFile: (v: boolean) => void;
    setMacroEntries: (entries: MacroEntry[]) => void;
    addMacroEntry: (name?: string) => void;
    renameMacroEntry: (index: number, nextName: string) => void;
    removeMacroEntry: (index: number) => void;
    updateMacroCommands: (index: number, commands: any[]) => void;
    moveMacroEntries: (fromIndices: number[], targetIndex: number) => void;
    duplicateMacroEntries: (indices: number[]) => void;
    deleteMacroEntries: (indices: number[]) => void;
    saveActiveMacroFromScript: (script: any[]) => void;
}

export interface ProjectManifestSlice {
    manifest: any | null;
    characters: Record<string, any>;
    items: Record<string, any>;
    macros: Record<string, any[]>;
    scenes: Record<string, any[]>;
    loadManifest: () => Promise<void>;
}

export interface ProjectIoSlice {
    saveActiveFileFromCurrentScript: () => Promise<void>;
    openProjectFromManifest: (manifestPath: string) => Promise<void>;
}

export interface ProjectState extends ProjectSessionSlice, ProjectMacrosSlice, ProjectManifestSlice, ProjectIoSlice {}

export type ProjectGet = () => ProjectState;

