import { readTextFile } from '@tauri-apps/plugin-fs';
import type { ProjectGet, ProjectManifestSlice, ProjectSet } from '../types';

async function resolveManifestValueFromDisk<T>(value: T | string, projectPath: string): Promise<T> {
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

export function createProjectManifestSlice(set: ProjectSet, get: ProjectGet): ProjectManifestSlice {
    return {
        manifest: null,
        characters: {},
        items: {},
        macros: {},
        scenes: {},

        loadManifest: async () => {
            const { projectPath } = get();
            if (!projectPath) return;

            try {
                const manifestText = await readTextFile(projectPath + '/game.json');
                const manifest = JSON.parse(manifestText);

                const [characters, items, macros, scenes] = await Promise.all([
                    manifest.characters ? resolveManifestValueFromDisk(manifest.characters, projectPath) : Promise.resolve({}),
                    manifest.items ? resolveManifestValueFromDisk(manifest.items, projectPath) : Promise.resolve({}),
                    manifest.macros ? resolveManifestValueFromDisk(manifest.macros, projectPath) : Promise.resolve({}),
                    manifest.scenes ? resolveScenesDisk(manifest.scenes, projectPath) : Promise.resolve({}),
                ]);

                set({ manifest, characters, items, macros, scenes });
            } catch (err) {
                console.error('Failed to load manifest:', err);
            }
        },
    };
}

