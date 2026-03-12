import type { GlobalSearchMatch, GlobalSearchProjectData } from './contracts';

import { getAtPath, setAtPath } from './pathAccess';
import { toMacroName, toMacroRelativePath, toSceneName } from './pathLabels';
import {
    replaceSearchValue,
    type ResolvedGlobalSearchTextOptions,
} from './textSearch';


export function applyMatchReplacement({
    match,
    nextCharacters,
    nextItems,
    nextMacros,
    nextScenes,
    query,
    replacement,
    textOptions,
}: {
    match: GlobalSearchMatch;
    nextCharacters: GlobalSearchProjectData['characters'];
    nextItems: GlobalSearchProjectData['items'];
    nextMacros: GlobalSearchProjectData['macros'];
    nextScenes: GlobalSearchProjectData['scenes'];
    query: string;
    replacement: string;
    textOptions: ResolvedGlobalSearchTextOptions;
}): boolean {
    const valuePath = match.valuePath;
    if (!valuePath) return false;

    if (match.kind === 'character') {
        const current = getAtPath(nextCharacters, valuePath);
        if (typeof current !== 'string') return false;
        const nextValue = replaceSearchValue(current, query, replacement, textOptions);
        if (nextValue === current) return false;
        setAtPath(nextCharacters, valuePath, nextValue);
        return true;
    }

    if (match.kind === 'item') {
        const current = getAtPath(nextItems, valuePath);
        if (typeof current !== 'string') return false;
        const nextValue = replaceSearchValue(current, query, replacement, textOptions);
        if (nextValue === current) return false;
        setAtPath(nextItems, valuePath, nextValue);
        return true;
    }

    if (match.kind === 'macro') {
        const macroName = toMacroName(match.label);
        if (!macroName || !Array.isArray(nextMacros[macroName])) return false;

        const macroRelativePath = toMacroRelativePath(valuePath);
        if (!macroRelativePath) return false;

        const current = getAtPath(nextMacros[macroName], macroRelativePath);
        if (typeof current !== 'string') return false;
        const nextValue = replaceSearchValue(current, query, replacement, textOptions);
        if (nextValue === current) return false;
        setAtPath(nextMacros[macroName], macroRelativePath, nextValue);
        return true;
    }

    const sceneName = toSceneName(match.label);
    if (!sceneName || !Array.isArray(nextScenes[sceneName])) return false;
    const current = getAtPath(nextScenes[sceneName], valuePath);
    if (typeof current !== 'string') return false;
    const nextValue = replaceSearchValue(current, query, replacement, textOptions);
    if (nextValue === current) return false;
    setAtPath(nextScenes[sceneName], valuePath, nextValue);
    return true;
}

