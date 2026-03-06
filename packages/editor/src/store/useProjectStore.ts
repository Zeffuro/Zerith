import { create } from 'zustand';
import type { DirEntry } from '@tauri-apps/plugin-fs';
import { readTextFile } from '@tauri-apps/plugin-fs';
import { useScriptStore } from './useScriptStore';

interface ProjectState {
    projectPath: string | null;
    files: DirEntry[];
    activeFile: string | null;

    // Game Data
    manifest: any | null;
    characters: Record<string, any>;
    items: Record<string, any>;
    macros: Record<string, any[]>;
    scenes: Record<string, any[]>;

    setProject: (path: string, files: DirEntry[]) => void;
    loadManifest: () => Promise<void>;
    setActiveFile: (file: string, content: any[]) => void;
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

export const useProjectStore = create<ProjectState>()(
    (set, get) => ({
        projectPath: null,
        files: [],
        activeFile: null,
        manifest: null,
        characters: {},
        items: {},
        macros: {},
        scenes: {},

        setProject: (path, files) => set({
            projectPath: path,
            files,
            activeFile: null,
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

        setActiveFile: (file, content) => {
            set({ activeFile: file });
            useScriptStore.getState().setScript(content);
        },
    })
);