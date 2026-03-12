import type { GlobalSearchMatch, GlobalSearchProjectData } from './contracts';

import { deriveManifestFilePaths } from './manifestPaths';
import { collectCharacterMatches, collectItemMatches } from './recordSourceSearch';
import { collectMacroMatches, collectSceneMatches } from './scriptSourceSearch';
import type { ResolvedGlobalSearchTextOptions } from './textSearch';

export function collectOrchestratedMatches(
    query: string,
    projectData: GlobalSearchProjectData,
    textOptions: ResolvedGlobalSearchTextOptions,
): GlobalSearchMatch[] {
    const { characters, items, macros, manifest, projectPath, scenes } = projectData;

    const matches: GlobalSearchMatch[] = [];
    const { charactersPath, itemsPath, macrosPath } = deriveManifestFilePaths(projectData);

    collectSceneMatches(matches, query, scenes, manifest, projectPath ?? '', textOptions);
    collectMacroMatches(matches, query, macros, { macrosPath }, textOptions);
    collectCharacterMatches(matches, query, characters, { charactersPath }, textOptions);
    collectItemMatches(matches, query, items, { itemsPath }, textOptions);

    return matches;
}

