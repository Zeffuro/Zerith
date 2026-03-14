import type { GlobalSearchMatch, GlobalSearchProjectData, GlobalSearchTextOptions } from './contracts';

import { useProjectStore } from '../../store/storeBootstrap';
import { collectSearchMatches } from './orchestration';
import { createSearchRequestContext } from './requestContext';
import { isSearchRequestValid } from './searchValidation';

export function searchProjectContent(
    query: string,
    projectData: GlobalSearchProjectData = useProjectStore.getState(),
    textOptions: GlobalSearchTextOptions = {},
): GlobalSearchMatch[] {
    const { normalizedQuery, resolvedTextOptions } = createSearchRequestContext(query, textOptions);
    if (!isSearchRequestValid(normalizedQuery, resolvedTextOptions)) return [];

    return collectSearchMatches(normalizedQuery, projectData, resolvedTextOptions);
}

