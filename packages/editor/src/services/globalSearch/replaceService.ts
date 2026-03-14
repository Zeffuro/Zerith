import type {
    GlobalSearchMatch,
    GlobalSearchProjectData,
    GlobalSearchReplacementFile,
    GlobalSearchTextOptions,
} from './contracts';

import { useProjectStore } from '../../store/storeBootstrap';
import { collectReplacementFiles } from './replacementOrchestration';
import { createSearchRequestContext } from './requestContext';
import { isReplacementRequestValid } from './searchValidation';

export function replaceProjectContent(
    query: string,
    replacement: string,
    matches: GlobalSearchMatch[],
    projectData: GlobalSearchProjectData = useProjectStore.getState(),
    textOptions: GlobalSearchTextOptions = {},
): GlobalSearchReplacementFile[] {
    const { normalizedQuery, resolvedTextOptions } = createSearchRequestContext(query, textOptions);
    if (!isReplacementRequestValid(normalizedQuery, projectData, resolvedTextOptions)) return [];

    return collectReplacementFiles(normalizedQuery, replacement, matches, projectData, resolvedTextOptions);
}

