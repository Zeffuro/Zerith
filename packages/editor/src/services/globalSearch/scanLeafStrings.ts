import type { ScriptPath } from '../../utils/scriptPathUtilities';
import type { GlobalSearchKind, GlobalSearchMatch } from './contracts';

import {
    matchesSearchValue,
    summarizeMatchedText,
    type ResolvedGlobalSearchTextOptions,
} from './textSearch';

export type ScanLeafOptions = {
    basePath: ScriptPath;
    filePath: string;
    kind: GlobalSearchKind;
    label: string;
    navigationPath: ScriptPath | undefined;
    query: string;
    textOptions: ResolvedGlobalSearchTextOptions;
    value: unknown;
};

export function scanLeafStrings(matches: GlobalSearchMatch[], options: ScanLeafOptions): void {
    if (typeof options.value === 'string') {
        const text = options.value;
        if (!matchesSearchValue(text, options.query, options.textOptions)) return;

        matches.push({
            filePath: options.filePath,
            kind: options.kind,
            label: options.label,
            matchedValue: text,
            path: options.navigationPath,
            preview: summarizeMatchedText(text, options.query, options.textOptions),
            replaceable: true,
            valuePath: options.basePath,
        });
        return;
    }

    if (Array.isArray(options.value)) {
        for (const [index, value] of options.value.entries()) {
            scanLeafStrings(matches, {
                ...options,
                basePath: [...options.basePath, index],
                value,
            });
        }
        return;
    }

    if (!options.value || typeof options.value !== 'object') {
        return;
    }

    for (const [key, value] of Object.entries(options.value as Record<string, unknown>)) {
        scanLeafStrings(matches, {
            ...options,
            basePath: [...options.basePath, key],
            value,
        });
    }
}

