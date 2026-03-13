import type { GlobalSearchMatch, GlobalSearchProjectData } from './contracts';

import { collectOrchestratedMatches } from './matchLifecycle';
import { isOrchestrationRequestValid } from './searchValidation';
import type { ResolvedGlobalSearchTextOptions } from './textSearch';

export function collectSearchMatches(
    query: string,
    projectData: GlobalSearchProjectData,
    textOptions: ResolvedGlobalSearchTextOptions,
): GlobalSearchMatch[] {
    if (!isOrchestrationRequestValid(query, projectData)) return [];

    return collectOrchestratedMatches(query, projectData, textOptions);
}

