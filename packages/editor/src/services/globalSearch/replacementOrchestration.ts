import type { GlobalSearchMatch, GlobalSearchProjectData, GlobalSearchReplacementFile } from './contracts';
import type { ResolvedGlobalSearchTextOptions } from './textSearch';

import { applyMatchReplacement } from './replace';
import { toReplacementFilePayload } from './replacementFiles';

export function collectReplacementFiles(
    query: string,
    replacement: string,
    matches: GlobalSearchMatch[],
    projectData: GlobalSearchProjectData,
    textOptions: ResolvedGlobalSearchTextOptions,
): GlobalSearchReplacementFile[] {
    const nextCharacters = structuredClone(projectData.characters);
    const nextItems = structuredClone(projectData.items);
    const nextMacros = structuredClone(projectData.macros);
    const nextScenes = structuredClone(projectData.scenes);

    const changedFilePaths = new Set<string>();
    const replaceableMatches = matches.filter((match) => match.replaceable && Array.isArray(match.valuePath));

    for (const match of replaceableMatches) {
        const valuePath = match.valuePath;
        if (!valuePath || valuePath.length === 0) continue;

        const changed = applyMatchReplacement({
            match,
            nextCharacters,
            nextItems,
            nextMacros,
            nextScenes,
            query,
            replacement,
            textOptions,
        });

        if (changed) {
            changedFilePaths.add(match.filePath);
        }
    }

    const files: GlobalSearchReplacementFile[] = [];
    for (const filePath of changedFilePaths) {
        const payload = toReplacementFilePayload(filePath, nextCharacters, nextItems, nextMacros, nextScenes, projectData);
        if (payload) files.push(payload);
    }

    return files.toSorted((a, b) => a.filePath.localeCompare(b.filePath));
}

