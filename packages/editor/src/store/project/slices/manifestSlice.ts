import type { CharacterDefinition, Command, GameManifest, ItemManifestEntry } from 'core';

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
                const manifestText = await fsReadTextFile(`${projectPath}/game.json`);
                const parsedManifest: unknown = JSON.parse(manifestText);
                if (!isRecord(parsedManifest)) {
                    throw new TypeError('Manifest root must be an object');
                }

                const manifest = parsedManifest as GameManifest;

                const [characters, items, macros, scenes] = await Promise.all([
                    manifest.characters
                        ? resolveManifestValueFromDisk<Record<string, CharacterDefinition>>(manifest.characters, projectPath)
                        : Promise.resolve<Record<string, CharacterDefinition>>({}),
                    manifest.items
                        ? resolveManifestValueFromDisk<Record<string, ItemManifestEntry>>(manifest.items, projectPath)
                        : Promise.resolve<Record<string, ItemManifestEntry>>({}),
                    manifest.macros
                        ? resolveManifestValueFromDisk<Record<string, Command[]>>(manifest.macros, projectPath)
                        : Promise.resolve<Record<string, Command[]>>({}),
                    manifest.scenes && isRecord(manifest.scenes)
                        ? resolveScenesDisk(manifest.scenes, projectPath)
                        : Promise.resolve<Record<string, Command[]>>({}),
                ]);

                set({ characters, items, macros, manifest, scenes });
            } catch (error) {
                console.error('Failed to load manifest:', error);
            }
        },
        macros: {},
        manifest: undefined,

        scenes: {},
    };
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object';
}

async function resolveManifestValueFromDisk<T>(value: string | T, projectPath: string): Promise<T> {
    if (typeof value === 'string') {
        const filePath = `${projectPath}${value}`;
        const text = await fsReadTextFile(filePath);
        const parsed: unknown = JSON.parse(text);
        return parsed as T;
    }
    return value;
}


async function resolveScenesDisk(
    scenes: Record<string, unknown>,
    projectPath: string
): Promise<Record<string, Command[]>> {
    const resolved: Record<string, Command[]> = {};
    await Promise.all(
        Object.entries(scenes).map(async ([name, value]) => {
            if (typeof value !== 'string' && !Array.isArray(value)) {
                resolved[name] = [];
                return;
            }
            resolved[name] = await resolveManifestValueFromDisk<Command[]>(value, projectPath);
        })
    );
    return resolved;
}


