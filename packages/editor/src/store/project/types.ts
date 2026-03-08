import type { Command } from 'core';

import type { FsDirEntry } from '../../services/fs';
import type { EditorNode } from '../../types/EditorNode';

export type MacroEntry = { commands: Command[]; name: string; };

export type ProjectGet = () => ProjectState;

export interface ProjectIoSlice {
    openProjectFromManifest: (manifestPath: string) => Promise<void>;
    saveActiveFileFromCurrentScript: () => Promise<void>;
}

export interface ProjectMacrosSlice {
    activeMacroName: null | string;
    addMacroEntry: (name?: string) => void;
    deleteMacroEntries: (indices: number[]) => void;
    duplicateMacroEntries: (indices: number[]) => void;
    editingAllMacrosFile: boolean;
    macroEntries: MacroEntry[];
    moveMacroEntries: (fromIndices: number[], targetIndex: number) => void;
    removeMacroEntry: (index: number) => void;
    renameMacroEntry: (index: number, nextName: string) => void;
    saveActiveMacroFromScript: (script: Command[]) => void;
    setActiveMacroName: (name: null | string) => void;
    setEditingAllMacrosFile: (v: boolean) => void;
    setMacroEntries: (entries: MacroEntry[]) => void;
    updateMacroCommands: (index: number, commands: Command[]) => void;
}

export interface ProjectManifestSlice {
    characters: Record<string, any>;
    items: Record<string, any>;
    loadManifest: () => Promise<void>;
    macros: Record<string, Command[]>;
    manifest: any | null;
    scenes: Record<string, Command[]>;
}

export interface ProjectScriptBridge {
    getRootScript: () => EditorNode[];
    setScript: (content: EditorNode[]) => void;
}

export interface ProjectSessionSlice {
    activeFile: null | string;
    bumpTreeRevision: () => void;
    files: FsDirEntry[];
    projectPath: null | string;
    setActiveFile: (file: string, content: EditorNode[]) => void;
    setProject: (path: string, files: FsDirEntry[]) => void;
    treeRevision: number;
}

export type ProjectSet = (
    partial: ((state: Record<string, any>) => Record<string, any>) | Record<string, any>
) => void;

export interface ProjectState extends ProjectIoSlice, ProjectMacrosSlice, ProjectManifestSlice, ProjectSessionSlice {}

