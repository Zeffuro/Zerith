import { describe, expect, it } from 'vitest';

import type { GlobalSearchMatch } from '../globalSearch/contracts';

import { createGlobalSearchProjectData } from '../../test-utils/projectDataBuilder';
import { collectReplacementFiles } from '../globalSearch/replacementOrchestration';
import { resolveGlobalSearchTextOptions } from '../globalSearch/textSearch';

describe('globalSearch replacement orchestration helpers', () => {
    it('returns deduplicated and sorted changed files', () => {
        const projectData = createGlobalSearchProjectData();
        const matches: GlobalSearchMatch[] = [
            {
                filePath: '/project/scripts/intro.json',
                kind: 'scene',
                label: 'Scene: intro',
                matchedValue: 'hero appears',
                path: [0, 'text'],
                preview: 'hero appears',
                replaceable: true,
                valuePath: [0, 'text'],
            },
            {
                filePath: '/project/data/macros.json',
                kind: 'macro',
                label: 'Macro: greet',
                matchedValue: 'hello hero',
                path: [0, 'text'],
                preview: 'hello hero',
                replaceable: true,
                valuePath: [0, 'body', 0, 'text'],
            },
            {
                filePath: '/project/data/characters.json',
                kind: 'character',
                label: 'Character: hero',
                matchedValue: 'Hero',
                path: ['hero', 'displayName'],
                preview: 'Hero',
                replaceable: true,
                valuePath: ['hero', 'displayName'],
            },
            {
                filePath: '/project/scripts/intro.json',
                kind: 'scene',
                label: 'Scene: intro',
                matchedValue: 'hero appears',
                path: [0, 'text'],
                preview: 'hero appears',
                replaceable: true,
                valuePath: [0, 'text'],
            },
        ];

        const files = collectReplacementFiles(
            'hero',
            'champion',
            matches,
            projectData,
            resolveGlobalSearchTextOptions({}),
        );

        expect(files.map((file) => file.filePath)).toEqual([
            '/project/data/characters.json',
            '/project/data/macros.json',
            '/project/scripts/intro.json',
        ]);
        expect(files.every((file) => file.content.includes('champion'))).toBe(true);
    });

    it('ignores non-replaceable and empty-path matches', () => {
        const projectData = createGlobalSearchProjectData();
        const files = collectReplacementFiles(
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
            resolveGlobalSearchTextOptions({}),
        );

        expect(files).toEqual([]);
    });

    it('does not mutate input project data', () => {
        const projectData = createGlobalSearchProjectData();
        const originalMacroText = projectData.macros.greet[0]?.text;
        const originalSceneText = projectData.scenes.intro[0]?.text;

        const files = collectReplacementFiles(
            'hero',
            'champion',
            [
                {
                    filePath: '/project/data/macros.json',
                    kind: 'macro',
                    label: 'Macro: greet',
                    matchedValue: 'hello hero',
                    path: [0, 'text'],
                    preview: 'hello hero',
                    replaceable: true,
                    valuePath: [0, 'body', 0, 'text'],
                },
                {
                    filePath: '/project/scripts/intro.json',
                    kind: 'scene',
                    label: 'Scene: intro',
                    matchedValue: 'hero appears',
                    path: [0, 'text'],
                    preview: 'hero appears',
                    replaceable: true,
                    valuePath: [0, 'text'],
                },
            ],
            projectData,
            resolveGlobalSearchTextOptions({}),
        );

        expect(files.length).toBeGreaterThan(0);
        expect(projectData.macros.greet[0]?.text).toBe(originalMacroText);
        expect(projectData.scenes.intro[0]?.text).toBe(originalSceneText);
    });
});


