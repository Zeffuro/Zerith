import type { GlobalSearchMatch, GlobalSearchProjectData } from './contracts';

import { collectOrchestratedMatches } from './matchLifecycle';
import { isOrchestrationRequestValid } from './searchValidation';
import type { ResolvedGlobalSearchTextOptions } from './textSearch';

export type SearchProjectData = GlobalSearchProjectData;
export type SearchMatch = GlobalSearchMatch;

export function collectSearchMatches(
    query: string,
    projectData: SearchProjectData,
    textOptions: ResolvedGlobalSearchTextOptions,
): SearchMatch[] {
    if (!isOrchestrationRequestValid(query, projectData)) return [];

    return collectOrchestratedMatches(query, projectData, textOptions);
}

