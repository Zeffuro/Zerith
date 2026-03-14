export type ResolvedGlobalSearchTextOptions = {
    caseSensitive: boolean;
    regex: boolean;
};

export function findSearchMatchStart(
    source: string,
    query: string,
    textOptions: ResolvedGlobalSearchTextOptions,
): number {
    if (!query) return -1;

    if (!textOptions.regex) {
        if (textOptions.caseSensitive) {
            return source.indexOf(query);
        }
        return source.toLowerCase().indexOf(query.toLowerCase());
    }

    const expression = toSearchExpression(query, textOptions, false);
    if (!expression) return -1;
    return source.search(expression);
}

export function matchesSearchValue(
    source: string,
    query: string,
    textOptions: ResolvedGlobalSearchTextOptions,
): boolean {
    return findSearchMatchStart(source, query, textOptions) >= 0;
}

export function replaceSearchValue(
    source: string,
    query: string,
    replacement: string,
    textOptions: ResolvedGlobalSearchTextOptions,
): string {
    if (!query) return source;
    const expression = toSearchExpression(query, textOptions, true);
    if (!expression) return source;
    return source.replaceAll(expression, replacement);
}

export function resolveGlobalSearchTextOptions(
    textOptions: { caseSensitive?: boolean; regex?: boolean },
): ResolvedGlobalSearchTextOptions {
    return {
        caseSensitive: Boolean(textOptions.caseSensitive),
        regex: Boolean(textOptions.regex),
    };
}

export function summarizeMatchedText(
    value: string,
    query: string,
    textOptions: ResolvedGlobalSearchTextOptions,
): string {
    if (value.length <= 140) return value;

    const at = findSearchMatchStart(value, query, textOptions);
    if (at === -1) return `${value.slice(0, 137)}...`;

    const start = Math.max(0, at - 40);
    const end = Math.min(value.length, at + query.length + 60);
    const prefix = start > 0 ? '...' : '';
    const suffix = end < value.length ? '...' : '';
    return `${prefix}${value.slice(start, end)}${suffix}`;
}

export function toSearchExpression(
    query: string,
    textOptions: ResolvedGlobalSearchTextOptions,
    global: boolean,
): RegExp | undefined {
    if (!query) return undefined;

    try {
        if (textOptions.regex) {
            const flags = `${textOptions.caseSensitive ? '' : 'i'}${global ? 'g' : ''}`;
            return new RegExp(query, flags);
        }

        const escaped = query.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
        const flags = `${textOptions.caseSensitive ? '' : 'i'}${global ? 'g' : ''}`;
        return new RegExp(escaped, flags);
    } catch {
        return undefined;
    }
}

