import type { ProjectGet, ProjectManifestSlice, ProjectSet } from '../types';

import { fsReadTextFile } from '../../../services/fs';

export function createProjectManifestSlice(set: ProjectSet, get: ProjectGet): ProjectManifestSlice {
    return {
        characters: {},
        items: {},
        loadManifest: async () => {
            const { projectPath } = get();
            if (!projectPath) return;

            try {
                const manifestText = await fsReadTextFile(projectPath + '/game.json');
                const manifest = JSON.parse(manifestText);

                const [characters, items, macros, scenes] = await Promise.all([
                    manifest.characters ? resolveManifestValueFromDisk(manifest.characters, projectPath) : Promise.resolve({}),
                    manifest.items ? resolveManifestValueFromDisk(manifest.items, projectPath) : Promise.resolve({}),
                    manifest.macros ? resolveManifestValueFromDisk(manifest.macros, projectPath) : Promise.resolve({}),
                    manifest.scenes ? resolveScenesDisk(manifest.scenes, projectPath) : Promise.resolve({}),
                ]);

                set({ characters, items, macros, manifest, scenes });
            } catch (error) {
                console.error('Failed to load manifest:', error);
            }
        },
        macros: {},
        manifest: null,

        scenes: {},
    };
}

async function resolveManifestValueFromDisk<T>(value: string | T, projectPath: string): Promise<T> {
    if (typeof value === 'string') {
        const filePath = projectPath + value;
        const text = await fsReadTextFile(filePath);
        return JSON.parse(text);
    }
    return value;
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

