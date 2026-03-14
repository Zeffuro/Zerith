import type { GlobalSearchMatch } from '../../services/globalSearch';

import { makeMatchKey, previewReplaceValue } from './globalSearchPanelModel';

export function buildReplacePreviewMap(
    results: GlobalSearchMatch[],
    query: string,
    replacement: string,
    options: { caseSensitive: boolean; regex: boolean },
): Map<string, string> {
    const replacePreview = new Map<string, string>();
    const trimmedQuery = query.trim();
    const hasReplaceDraft = replacement.length > 0;

    if (!trimmedQuery || !hasReplaceDraft) {
        return replacePreview;
    }

    for (const [index, match] of results.entries()) {
        if (!match.replaceable) continue;
        const replaced = previewReplaceValue(match.matchedValue, trimmedQuery, replacement, options);
        if (replaced !== match.matchedValue) {
            replacePreview.set(makeMatchKey(match, index), replaced);
        }
    }

    return replacePreview;
}

export function groupMatchesByFile(results: GlobalSearchMatch[]): Array<[string, GlobalSearchMatch[]]> {
    const groups = new Map<string, GlobalSearchMatch[]>();
    for (const result of results) {
        if (!groups.has(result.filePath)) {
            groups.set(result.filePath, []);
        }
        groups.get(result.filePath)?.push(result);
    }

    return [...groups.entries()];
}

export function indexMatches(results: GlobalSearchMatch[]): Map<GlobalSearchMatch, number> {
    const map = new Map<GlobalSearchMatch, number>();
    for (const [index, result] of results.entries()) {
        map.set(result, index);
    }
    return map;
}

