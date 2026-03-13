import type {
    GlobalSearchProjectData,
    GlobalSearchReplacementFile,
    ReplacementTarget,
} from './contracts';

import { resolveReplacementTarget } from './replacementTargetResolver';

export function toReplacementFilePayload(
    filePath: string,
    nextCharacters: GlobalSearchProjectData['characters'],
    nextItems: GlobalSearchProjectData['items'],
    nextMacros: GlobalSearchProjectData['macros'],
    nextScenes: GlobalSearchProjectData['scenes'],
    projectData: GlobalSearchProjectData,
): GlobalSearchReplacementFile | undefined {
    const target: ReplacementTarget | undefined = resolveReplacementTarget(filePath, nextScenes, projectData);
    if (!target) return undefined;

    switch (target.kind) {
        case 'character': {
            return { content: JSON.stringify(nextCharacters, undefined, 2), filePath, kind: 'character' };
        }
        case 'item': {
            return { content: JSON.stringify(nextItems, undefined, 2), filePath, kind: 'item' };
        }
        case 'macro': {
            return { content: JSON.stringify(nextMacros, undefined, 2), filePath, kind: 'macro' };
        }
        case 'scene': {
            return {
                content: JSON.stringify(nextScenes[target.sceneName], undefined, 2),
                filePath,
                kind: 'scene',
            };
        }
    }
}

