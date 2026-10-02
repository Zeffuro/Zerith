import type { ProjectGet, ProjectManifestSlice, ProjectSet } from '../types';

import { normalizePathForComparison } from '../../../utils/pathComparison';
import { loadProjectManifest, resolveProjectFilePath } from '../projectPreparation';


export function createProjectManifestSlice(set: ProjectSet, get: ProjectGet): ProjectManifestSlice {
    let loadSequence = 0;
    return {
        characters: {},
        items: {},
        loadManifest: async () => {
            const { projectGeneration, projectPath } = get();
            const sequence = ++loadSequence;
            if (!projectPath) return false;

            try {
                const { characters, items, localePaths, locales, macros, manifest, sceneNamespaces, scenePaths, scenes } = await loadProjectManifest(projectPath);

                if (get().projectPath !== projectPath || get().projectGeneration !== projectGeneration || sequence !== loadSequence) return false;
                const current = get();
                const dirtyPaths = new Set([...current.dirtyFiles].map((path) => normalizePathForComparison(path)));
                const isDirty = (path: string | undefined) => path !== undefined && dirtyPaths.has(normalizePathForComparison(path));
                const isDirtyManifestValue = (value: unknown) => typeof value === 'string' && isDirty(resolveProjectFilePath(projectPath, value));
                set({
                    characters: isDirtyManifestValue(manifest.characters) ? current.characters : characters,
                    items: isDirtyManifestValue(manifest.items) ? current.items : items,
                    localePaths: preserveDirtyFileValues(localePaths, current.localePaths, current.localePaths, isDirty),
                    locales: preserveDirtyFileValues(locales, current.locales, current.localePaths, isDirty),
                    macros: isDirtyManifestValue(manifest.macros) ? current.macros : macros,
                    manifest: isDirty(resolveProjectFilePath(projectPath, 'game.json')) ? current.manifest : manifest,
                    sceneNamespaces: preserveDirtyFileValues(sceneNamespaces, current.sceneNamespaces, current.scenePaths, isDirty),
                    scenePaths: preserveDirtyFileValues(scenePaths, current.scenePaths, current.scenePaths, isDirty),
                    scenes: preserveDirtyFileValues(scenes, current.scenes, current.scenePaths, isDirty),
                });
                return true;
            } catch (error) {
                console.error('Failed to load manifest:', error);
                return false;
            }
        },
        localePaths: {},
        locales: {},
        macros: {},
        manifest: undefined,
        sceneNamespaces: {},
        scenePaths: {},
        scenes: {},
    };
}

function preserveDirtyFileValues<T>(
    loaded: Record<string, T>,
    previous: Record<string, T>,
    previousPaths: Record<string, string | undefined>,
    isDirty: (path: string | undefined) => boolean,
): Record<string, T> {
    const values = { ...loaded };
    for (const [name, path] of Object.entries(previousPaths)) {
        if (isDirty(path) && Object.hasOwn(previous, name)) values[name] = previous[name];
    }
    return values;
}
