import type { GlobalSearchProjectData } from './contracts';

import { toSearchExpression, type ResolvedGlobalSearchTextOptions } from './textSearch';

export function normalizeSearchQuery(query: string): string {
    return query.trim();
}

export function hasSearchQuery(query: string): boolean {
    return Boolean(query);
}

export function hasSearchProjectPath(projectData: Pick<GlobalSearchProjectData, 'projectPath'>): boolean {
    return Boolean(projectData.projectPath);
}

export function isSearchExpressionValid(
    query: string,
    textOptions: ResolvedGlobalSearchTextOptions,
): boolean {
    return Boolean(toSearchExpression(query, textOptions, false));
}

export function isSearchRequestValid(
    query: string,
    textOptions: ResolvedGlobalSearchTextOptions,
): boolean {
    if (!hasSearchQuery(query)) return false;
    return isSearchExpressionValid(query, textOptions);
}

export function isReplacementRequestValid(
    query: string,
    projectData: Pick<GlobalSearchProjectData, 'projectPath'>,
    textOptions: ResolvedGlobalSearchTextOptions,
): boolean {
    if (!hasSearchProjectPath(projectData)) return false;
    return isSearchRequestValid(query, textOptions);
}

export function isOrchestrationRequestValid(
    query: string,
    projectData: Pick<GlobalSearchProjectData, 'projectPath'>,
): boolean {
    if (!hasSearchProjectPath(projectData)) return false;
    return hasSearchQuery(query);
}

