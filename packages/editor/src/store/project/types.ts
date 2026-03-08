import type { Command, GameManifest } from 'core';

import type { FsDirEntry } from '../../services/fs';
import type { EditorNode } from '../../types/EditorNode';

export type MacroEntry = { commands: Command[]; name: string; };

export type ProjectGet = () => ProjectState;

export interface ProjectIoSlice {
    openProjectFromManifest: (manifestPath: string) => Promise<void>;
    saveActiveFileFromCurrentScript: () => Promise<void>;
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
    characters: Record<string, unknown>;
    items: Record<string, unknown>;
    loadManifest: () => Promise<void>;
    macros: Record<string, Command[]>;
    manifest: GameManifest | undefined;
    scenes: Record<string, Command[]>;
}

export interface ProjectScriptBridge {
    getRootScript: () => EditorNode[];
    setScript: (content: EditorNode[]) => void;
}

export interface ProjectSessionSlice {
    activeFile: string | undefined;
    bumpTreeRevision: () => void;
    files: FsDirEntry[];
    projectPath: string | undefined;
    setActiveFile: (file: string, content: EditorNode[]) => void;
    setProject: (path: string, files: FsDirEntry[]) => void;
    treeRevision: number;
}

export type ProjectSet = (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    partial: ((state: Record<string, any>) => Record<string, any>) | Record<string, any>
) => void;

export interface ProjectState extends ProjectIoSlice, ProjectMacrosSlice, ProjectManifestSlice, ProjectSessionSlice {}
