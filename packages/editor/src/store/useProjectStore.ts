import { create } from 'zustand';
import type { DirEntry } from '@tauri-apps/plugin-fs';
import { readTextFile } from '@tauri-apps/plugin-fs';

interface ProjectState {
    projectPath: string | null;
    files: DirEntry[];
    manifest: any | null;
    characters: Record<string, any>;
    items: Record<string, any>;
    macros: Record<string, any[]>;
    scenes: Record<string, any[]>;

    playTrigger: number;
    triggerPlay: () => void;

    uiScale: number;
    setUiScale: (scale: number) => void;

    setProject: (path: string, files: DirEntry[]) => void;
    loadManifest: () => Promise<void>;

    activeFile: string | null;
    script: any[];
    selectedNodeIndex: number | null;

    setActiveFile: (file: string, content: any[]) => void;
    updateScript: (newScript: any[]) => void;
    setSelectedNode: (index: number | null) => void;
    moveNode: (index: number, direction: 'up' | 'down') => void;
}

async function resolveManifestValueFromDisk<T>(
    value: T | string,
    projectPath: string
): Promise<T> {
    if (typeof value === 'string') {
        const filePath = projectPath + value;
        const text = await readTextFile(filePath);
        return JSON.parse(text);
    }
    return value as T;
}

async function resolveScenesDisk(
    scenes: Record<string, any>,
    projectPath: string
): Promise<Record<string, any[]>> {
    const resolved: Record<string, any[]> = {};
    await Promise.all(
        Object.entries(scenes).map(async ([name, value]) => {
            resolved[name] = await resolveManifestValueFromDisk<any[]>(value, projectPath);
        })
    );
    return resolved;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
    projectPath: null,
    files: [],
    manifest: null,
    characters: {},
    items: {},
    macros: {},
    scenes: {} as Record<string, any[]>,

    playTrigger: 0,
    triggerPlay: () => set((state) => ({ playTrigger: state.playTrigger + 1 })),

    uiScale: 1.0,
    setUiScale: (scale) => set({ uiScale: scale }),

    setProject: (path, files) => set({
        projectPath: path,
        files,
        activeFile: null,
        script: [],
        selectedNodeIndex: null,
        manifest: null,
        characters: {},
        items: {},
        macros: {},
        scenes: {},
    }),

    loadManifest: async () => {
        const { projectPath } = get();
        if (!projectPath) return;

        try {
            const manifestText = await readTextFile(projectPath + '/game.json');
            const manifest = JSON.parse(manifestText);

            const [characters, items, macros, scenes] = await Promise.all([
                manifest.characters
                    ? resolveManifestValueFromDisk(manifest.characters, projectPath)
                    : Promise.resolve({}),
                manifest.items
                    ? resolveManifestValueFromDisk(manifest.items, projectPath)
                    : Promise.resolve({}),
                manifest.macros
                    ? resolveManifestValueFromDisk(manifest.macros, projectPath)
                    : Promise.resolve({}),
                manifest.scenes
                    ? resolveScenesDisk(manifest.scenes, projectPath)
                    : Promise.resolve({}),
            ]);

            set({ manifest, characters, items, macros, scenes });
        } catch (err) {
            console.error('Failed to load manifest:', err);
        }
    },

    activeFile: null,
    script: [
        { type: 'background', assetUrl: 'https://picsum.photos/1280/720.jpg' },
        { type: 'dialogue', speaker: 'System', text: 'Select "Open Project" to load your game.' }
    ],
    selectedNodeIndex: null,

    setActiveFile: (file, content) => set({ activeFile: file, script: content, selectedNodeIndex: null }),
    updateScript: (newScript) => set({ script: newScript }),
    setSelectedNode: (index) => set({ selectedNodeIndex: index }),
    moveNode: (index, direction) => {
        const { script } = get();
        if (index === null || index < 0 || index >= script.length) return;

        const newIndex = direction === 'up' ? index - 1 : index + 1;
        if (newIndex < 0 || newIndex >= script.length) return;

        const newScript = [...script];
        [newScript[index], newScript[newIndex]] = [newScript[newIndex], newScript[index]];

        set({ script: newScript, selectedNodeIndex: newIndex });
    },
}));