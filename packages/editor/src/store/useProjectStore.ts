import { create } from 'zustand';
import type { DirEntry } from '@tauri-apps/plugin-fs';

interface ProjectState {
    projectPath: string | null;
    files: DirEntry[];
    setProject: (path: string, files: DirEntry[]) => void;

    activeFile: string | null;
    script: any[];
    selectedNodeIndex: number | null;

    setActiveFile: (file: string, content: any[]) => void;
    updateScript: (newScript: any[]) => void;
    setSelectedNode: (index: number | null) => void;
}

export const useProjectStore = create<ProjectState>((set) => ({
    projectPath: null,
    files:[],
    setProject: (path, files) => set({ projectPath: path, files, activeFile: null, script: [], selectedNodeIndex: null }),

    activeFile: null,
    script:[
        { type: 'background', assetUrl: 'https://picsum.photos/1280/720.jpg' },
        { type: 'dialogue', speaker: 'System', text: 'Select "Open Project" to load your game.' }
    ],
    selectedNodeIndex: null,

    setActiveFile: (file, content) => set({ activeFile: file, script: content, selectedNodeIndex: null }),
    updateScript: (newScript) => set({ script: newScript }),
    setSelectedNode: (index) => set({ selectedNodeIndex: index }),
}));