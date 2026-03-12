import type { GlobalSearchKind, GlobalSearchProjectData } from './contracts';

import { deriveManifestFilePaths, deriveSceneFilePathMap } from './manifestPaths';

type ReplacementTarget =
    | { kind: Exclude<GlobalSearchKind, 'scene'> }
    | { kind: 'scene'; sceneName: string };

export function resolveReplacementTarget(
    filePath: string,
    scenes: GlobalSearchProjectData['scenes'],
    projectData: GlobalSearchProjectData,
): ReplacementTarget | undefined {
    const { charactersPath, itemsPath, macrosPath } = deriveManifestFilePaths(projectData);
    const scenePathMap = deriveSceneFilePathMap(scenes, projectData);

    if (filePath === charactersPath) return { kind: 'character' };

    if (filePath === itemsPath) return { kind: 'item' };

    if (filePath === macrosPath) return { kind: 'macro' };

    for (const [sceneName, sceneFilePath] of Object.entries(scenePathMap)) {
        if (sceneFilePath === filePath) {
            return { kind: 'scene', sceneName };
        }
    }

    return undefined;
}

