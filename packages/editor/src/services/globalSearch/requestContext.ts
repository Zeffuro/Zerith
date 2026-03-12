import type { GlobalSearchTextOptions } from './contracts';

import { resolveGlobalSearchTextOptions, type ResolvedGlobalSearchTextOptions } from './textSearch';
import { normalizeSearchQuery } from './searchValidation';

export type SearchRequestContext = {
    normalizedQuery: string;
    resolvedTextOptions: ResolvedGlobalSearchTextOptions;
};

export function createSearchRequestContext(
    query: string,
    textOptions: GlobalSearchTextOptions,
): SearchRequestContext {
    return {
        normalizedQuery: normalizeSearchQuery(query),
        resolvedTextOptions: resolveGlobalSearchTextOptions(textOptions),
    };
}

