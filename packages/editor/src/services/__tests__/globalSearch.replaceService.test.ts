import { describe, expect, it } from 'vitest';

import '../../test-utils/registerEditorServiceMocks';
import { createGlobalSearchProjectData } from '../../test-utils/projectDataBuilder';
import { replaceProjectContent } from '../globalSearch/replaceService';
import { searchProjectContent } from '../globalSearch/searchService';

describe('globalSearch replaceService facade', () => {
    it('returns changed files for valid replacement requests', () => {
        const projectData = createGlobalSearchProjectData();
        const matches = searchProjectContent('hero', projectData);
        const files = replaceProjectContent('hero', 'champion', matches, projectData);

        expect(files.length).toBeGreaterThan(0);
        expect(files.some((file) => file.content.includes('champion'))).toBe(true);
    });

    it('returns no files when project path is missing', () => {
        const projectData = createGlobalSearchProjectData();
        const matches = searchProjectContent('hero', projectData);

        expect(
            replaceProjectContent('hero', 'champion', matches, {
                ...projectData,
                projectPath: undefined,
            }),
        ).toEqual([]);
    });
});

