import type { GlobalSearchTextOptions } from './contracts';

import { normalizeSearchQuery } from './searchValidation';
import { type ResolvedGlobalSearchTextOptions, resolveGlobalSearchTextOptions } from './textSearch';

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

