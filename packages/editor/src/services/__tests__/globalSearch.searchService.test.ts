import { describe, expect, it } from 'vitest';

import '../../test-utils/registerEditorServiceMocks';
import { createGlobalSearchProjectData } from '../../test-utils/projectDataBuilder';
import { searchProjectContent } from '../globalSearch/searchService';

describe('globalSearch searchService facade', () => {
    it('returns matches for valid requests', () => {
        const projectData = createGlobalSearchProjectData();
        const matches = searchProjectContent('hero', projectData);

        expect(matches.length).toBeGreaterThan(0);
        expect(matches.some((match) => match.kind === 'scene')).toBe(true);
    });

    it('returns no matches for invalid regex requests', () => {
        const projectData = createGlobalSearchProjectData();

        expect(searchProjectContent('(', projectData, { regex: true })).toEqual([]);
    });
});

