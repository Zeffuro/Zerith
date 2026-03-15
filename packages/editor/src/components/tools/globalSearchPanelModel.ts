import type { GlobalSearchMatch } from '../../services/globalSearch';

import { editorTheme as t } from '../../theme/editorTheme';

export function cycleResultIndex(current: number, length: number, delta: -1 | 1): number {
    if (length <= 0) return -1;
    if (current < 0) return delta > 0 ? 0 : length - 1;
    if (delta > 0) return (current + 1) % length;
    return (current - 1 + length) % length;
}

export function kindColor(kind: GlobalSearchMatch['kind']): string {
    if (kind === 'scene') return t.accent.blue;
    if (kind === 'macro') return t.accent.purple;
    if (kind === 'character') return t.accent.teal;
    return t.accent.yellow;
}

export function makeMatchKey(match: GlobalSearchMatch, index: number): string {
    return `${match.filePath}-${match.valuePath?.join('.') ?? match.path?.join('.') ?? 'root'}-${index}`;
}

export function normalizeActiveResultIndex(activeResultIndex: number, resultCount: number): number {
    if (resultCount <= 0) return -1;
    if (activeResultIndex < 0) return 0;
    if (activeResultIndex >= resultCount) return resultCount - 1;
    return activeResultIndex;
}

export function previewReplaceValue(
    source: string,
    query: string,
    replacement: string,
    options: { caseSensitive: boolean; regex: boolean },
): string {
    const expression = toSearchExpression(query, options, true);
    if (!expression) return source;
    return source.replaceAll(expression, replacement);
}

export function summarizeText(value: string): string {
    if (value.length <= 120) return value;
    return `${value.slice(0, 117)}...`;
}

export function toSearchExpression(
    query: string,
    options: { caseSensitive: boolean; regex: boolean },
    global: boolean,
): RegExp | undefined {
    if (!query) return;
    try {
        if (options.regex) {
            const flags = `${options.caseSensitive ? '' : 'i'}${global ? 'g' : ''}`;
            return new RegExp(query, flags);
        }

        const escaped = query.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
        const flags = `${options.caseSensitive ? '' : 'i'}${global ? 'g' : ''}`;
        return new RegExp(escaped, flags);
    } catch {
        return;
    }
}

