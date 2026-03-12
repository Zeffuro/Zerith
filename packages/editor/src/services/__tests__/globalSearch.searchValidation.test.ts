import { describe, expect, it } from 'vitest';

import { createGlobalSearchProjectData } from '../../test-utils/projectDataBuilder';
import {
    hasSearchProjectPath,
    hasSearchQuery,
    isOrchestrationRequestValid,
    isReplacementRequestValid,
    isSearchExpressionValid,
    isSearchRequestValid,
    normalizeSearchQuery,
} from '../globalSearch/searchValidation';
import { resolveGlobalSearchTextOptions } from '../globalSearch/textSearch';

describe('globalSearch search validation helpers', () => {
    it('normalizes query values by trimming whitespace', () => {
        expect(normalizeSearchQuery('  hero  ')).toBe('hero');
    });

    it('returns false for empty query values', () => {
        expect(hasSearchQuery('')).toBe(false);
    });

    it('returns false when project path is missing', () => {
        const projectData = createGlobalSearchProjectData({ projectPath: undefined });

        expect(hasSearchProjectPath(projectData)).toBe(false);
    });

    it('returns false for invalid regex expressions', () => {
        const valid = isSearchExpressionValid('hero', resolveGlobalSearchTextOptions({}));
        const invalid = isSearchExpressionValid('(', resolveGlobalSearchTextOptions({ regex: true }));

        expect(valid).toBe(true);
        expect(invalid).toBe(false);
    });

    it('composes search request validity from query and expression checks', () => {
        const valid = isSearchRequestValid('hero', resolveGlobalSearchTextOptions({}));
        const invalid = isSearchRequestValid('(', resolveGlobalSearchTextOptions({ regex: true }));

        expect(valid).toBe(true);
        expect(invalid).toBe(false);
    });

    it('composes replacement request validity from query, project path, and expression checks', () => {
        const validProject = createGlobalSearchProjectData();
        const missingPathProject = createGlobalSearchProjectData({ projectPath: undefined });

        expect(isReplacementRequestValid('hero', validProject, resolveGlobalSearchTextOptions({}))).toBe(true);
        expect(isReplacementRequestValid('hero', missingPathProject, resolveGlobalSearchTextOptions({}))).toBe(false);
        expect(isReplacementRequestValid('(', validProject, resolveGlobalSearchTextOptions({ regex: true }))).toBe(false);
    });

    it('composes orchestration request validity from query and project path checks', () => {
        const validProject = createGlobalSearchProjectData();
        const missingPathProject = createGlobalSearchProjectData({ projectPath: undefined });

        expect(isOrchestrationRequestValid('hero', validProject)).toBe(true);
        expect(isOrchestrationRequestValid('', validProject)).toBe(false);
        expect(isOrchestrationRequestValid('hero', missingPathProject)).toBe(false);
    });
});

