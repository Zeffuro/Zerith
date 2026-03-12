import { describe, expect, it } from 'vitest';

import { createGlobalSearchProjectData } from '../../test-utils/projectDataBuilder';
import '../../test-utils/registerEditorServiceMocks';
import { replaceProjectContent, searchProjectContent } from '../globalSearch';

const projectData = createGlobalSearchProjectData();

describe('globalSearch', () => {
    it('searchProjectContent finds matches across scene/macro/character/item sources', () => {
        const results = searchProjectContent('hero', projectData);
        const kinds = new Set(results.map((result) => result.kind));

        expect(results.length).toBeGreaterThan(0);
        expect(kinds.has('scene')).toBe(true);
        expect(kinds.has('macro')).toBe(true);
        expect(kinds.has('character')).toBe(true);
        expect(kinds.has('item')).toBe(true);
    });

    it('replaceProjectContent returns changed files for replaceable matches', () => {
        const matches = searchProjectContent('hero', projectData);
        const files = replaceProjectContent('hero', 'champion', matches, projectData);

        expect(files.length).toBeGreaterThan(0);
        expect(files.some((file) => file.filePath.endsWith('/scripts/intro.json'))).toBe(true);
        expect(files.some((file) => file.filePath.endsWith('/data/macros.json'))).toBe(true);

        const mergedContent = files.map((file) => file.content).join('\n');
        expect(mergedContent.includes('champion')).toBe(true);
    });

    it('replaceProjectContent supports regex text options', () => {
        const matches = searchProjectContent('hero', projectData);
        const files = replaceProjectContent('h[a-z]+', 'alias', matches, projectData, { regex: true });

        expect(files.length).toBeGreaterThan(0);
        expect(files.some((file) => file.content.includes('alias'))).toBe(true);
    });

    it('returns no results for invalid regex search queries', () => {
        const results = searchProjectContent('(', projectData, { regex: true });

        expect(results).toEqual([]);
    });

    it('returns no replacement files when project path is missing', () => {
        const matches = searchProjectContent('hero', projectData);
        const files = replaceProjectContent('hero', 'champion', matches, {
            ...projectData,
            projectPath: undefined,
        });

        expect(files).toEqual([]);
    });

    it('ignores matches that are not replaceable or have empty value paths', () => {
        const files = replaceProjectContent(
            'hero',
            'champion',
            [
                {
                    filePath: '/project/scripts/intro.json',
                    kind: 'scene',
                    label: 'Scene: intro',
                    matchedValue: 'hero appears',
                    path: [0, 'text'],
                    preview: 'hero appears',
                    replaceable: false,
                    valuePath: [0, 'text'],
                },
                {
                    filePath: '/project/scripts/intro.json',
                    kind: 'scene',
                    label: 'Scene: intro',
                    matchedValue: 'hero appears',
                    path: [0, 'text'],
                    preview: 'hero appears',
                    replaceable: true,
                    valuePath: [],
                },
            ],
            projectData,
        );

        expect(files).toEqual([]);
    });
});
