import type { GlobalSearchProjectData } from './contracts';

import { toRecord } from '../../utils/typeGuards';
import { resolveFilePath } from './pathLabels';

export type ManifestFilePaths = {
    charactersPath: string;
    itemsPath: string;
    macrosPath: string;
};

export function deriveManifestFilePaths(
    projectData: Pick<GlobalSearchProjectData, 'manifest' | 'projectPath'>,
): ManifestFilePaths {
    const manifestRecord = toRecord(projectData.manifest);
    const projectPath = projectData.projectPath ?? '';

    const charactersSource = manifestRecord.characters;
    const itemsSource = manifestRecord.items;
    const macrosSource = manifestRecord.macros;

    return {
        charactersPath: resolveFilePath(projectPath, typeof charactersSource === 'string' ? charactersSource : undefined),
        itemsPath: resolveFilePath(projectPath, typeof itemsSource === 'string' ? itemsSource : undefined),
        macrosPath: resolveFilePath(projectPath, typeof macrosSource === 'string' ? macrosSource : undefined),
    };
}

export function deriveSceneFilePathMap(
    scenes: GlobalSearchProjectData['scenes'],
    projectData: Pick<GlobalSearchProjectData, 'manifest' | 'projectPath'>,
): Record<string, string> {
    const manifestRecord = toRecord(projectData.manifest);
    const manifestScenes = toRecord(manifestRecord.scenes);
    const projectPath = projectData.projectPath ?? '';

    const scenePaths: Record<string, string> = {};
    for (const sceneName of Object.keys(scenes)) {
        const source = manifestScenes[sceneName];
        if (typeof source !== 'string') continue;
        scenePaths[sceneName] = resolveFilePath(projectPath, source);
    }

    return scenePaths;
}

