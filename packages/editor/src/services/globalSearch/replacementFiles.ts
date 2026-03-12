import type { GlobalSearchProjectData, GlobalSearchReplacementFile } from './contracts';

import { resolveReplacementTarget } from './replacementTargetResolver';

export function toReplacementFilePayload(
    filePath: string,
    nextCharacters: GlobalSearchProjectData['characters'],
    nextItems: GlobalSearchProjectData['items'],
    nextMacros: GlobalSearchProjectData['macros'],
    nextScenes: GlobalSearchProjectData['scenes'],
    projectData: GlobalSearchProjectData,
): GlobalSearchReplacementFile | undefined {
    const target = resolveReplacementTarget(filePath, nextScenes, projectData);
    if (!target) return undefined;

    if (target.kind === 'character') {
        return { content: JSON.stringify(nextCharacters, undefined, 2), filePath, kind: 'character' };
    }

    if (target.kind === 'item') {
        return { content: JSON.stringify(nextItems, undefined, 2), filePath, kind: 'item' };
    }

    if (target.kind === 'macro') {
        return { content: JSON.stringify(nextMacros, undefined, 2), filePath, kind: 'macro' };
    }

    if (target.kind !== 'scene') return undefined;

    return {
        content: JSON.stringify(nextScenes[target.sceneName], undefined, 2),
        filePath,
        kind: 'scene',
    };
}

