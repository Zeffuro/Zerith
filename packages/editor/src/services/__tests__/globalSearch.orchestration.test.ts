import { describe, expect, it } from 'vitest';

import '../../test-utils/registerEditorServiceMocks';
import type { GlobalSearchMatch, GlobalSearchProjectData } from '../globalSearch/contracts';

import { createGlobalSearchProjectData } from '../../test-utils/projectDataBuilder';
import { collectOrchestratedMatches } from '../globalSearch/matchLifecycle';
import { collectSearchMatches } from '../globalSearch/orchestration';
import { collectCharacterMatches, collectItemMatches } from '../globalSearch/recordSourceSearch';
import { collectReplacementFiles } from '../globalSearch/replacementOrchestration';
import { collectMacroMatches, collectSceneMatches } from '../globalSearch/scriptSourceSearch';
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

describe('globalSearch orchestration helpers', () => {
    it('collects matches across scene/macro/character/item sources', () => {
        const projectData = createGlobalSearchProjectData();
        const matches = collectSearchMatches('hero', projectData, resolveGlobalSearchTextOptions({}));
        const kinds = new Set(matches.map((match) => match.kind));

        expect(matches.length).toBeGreaterThan(0);
        expect(kinds.has('scene')).toBe(true);
        expect(kinds.has('macro')).toBe(true);
        expect(kinds.has('character')).toBe(true);
        expect(kinds.has('item')).toBe(true);
    });

    it('prefixes macro value paths with macro index/body root path', () => {
        const projectData = createGlobalSearchProjectData({
            macros: {
                alpha: [{ speaker: 'Guide', text: 'hero alpha', type: 'dialogue' }],
                beta: [{ speaker: 'Guide', text: 'hero beta', type: 'dialogue' }],
            },
        });

        const matches = collectSearchMatches('hero', projectData, resolveGlobalSearchTextOptions({}));
        const macroMatches = matches.filter((match) => match.kind === 'macro');

        expect(macroMatches.length).toBeGreaterThan(0);
        expect(macroMatches.every((match) => match.valuePath?.[1] === 'body')).toBe(true);
        expect(macroMatches.some((match) => match.valuePath?.[0] === 0)).toBe(true);
        expect(macroMatches.some((match) => match.valuePath?.[0] === 1)).toBe(true);
    });

    it('returns an empty result when orchestration request is invalid', () => {
        const projectData = createGlobalSearchProjectData({ projectPath: undefined });

        const matches = collectSearchMatches('hero', projectData, resolveGlobalSearchTextOptions({}));

        expect(matches).toEqual([]);
    });
});

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

describe('globalSearch match lifecycle helpers', () => {
    it('collects matches across all orchestrated sources', () => {
        const projectData = createGlobalSearchProjectData();
        const matches = collectOrchestratedMatches('hero', projectData, resolveGlobalSearchTextOptions({}));
        const kinds = new Set(matches.map((match) => match.kind));

        expect(matches.length).toBeGreaterThan(0);
        expect(kinds.has('scene')).toBe(true);
        expect(kinds.has('macro')).toBe(true);
        expect(kinds.has('character')).toBe(true);
        expect(kinds.has('item')).toBe(true);
    });

    it('returns an empty array when all sources are empty', () => {
        const projectData = createGlobalSearchProjectData({
            characters: {},
            items: {},
            macros: {},
            scenes: {},
        });

        expect(collectOrchestratedMatches('hero', projectData, resolveGlobalSearchTextOptions({}))).toEqual([]);
    });

    it('preserves macro root path indexing from sorted macro names', () => {
        const projectData = createGlobalSearchProjectData({
            macros: {
                alpha: [{ speaker: 'Guide', text: 'hero alpha', type: 'dialogue' }],
                beta: [{ speaker: 'Guide', text: 'hero beta', type: 'dialogue' }],
            },
        });

        const matches = collectOrchestratedMatches('hero', projectData, resolveGlobalSearchTextOptions({}));
        const macroMatches = matches.filter((match) => match.kind === 'macro' && match.valuePath?.includes('text'));

        expect(macroMatches.some((match) => match.label === 'Macro: alpha' && match.valuePath?.[0] === 0)).toBe(true);
        expect(macroMatches.some((match) => match.label === 'Macro: beta' && match.valuePath?.[0] === 1)).toBe(true);
        expect(macroMatches.every((match) => match.valuePath?.[1] === 'body')).toBe(true);
    });
});

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

describe('globalSearch record source search helpers', () => {
    it('collects character matches with expected kind, label, and file path', () => {
        const matches: GlobalSearchMatch[] = [];
        const characters: GlobalSearchProjectData['characters'] = {
            hero: { displayName: 'Hero', name: 'hero' },
        };

        collectCharacterMatches(
            matches,
            'hero',
            characters,
            { charactersPath: '/project/data/characters.json' },
            resolveGlobalSearchTextOptions({}),
        );

        expect(matches.length).toBeGreaterThan(0);
        expect(matches.every((match) => match.kind === 'character')).toBe(true);
        expect(matches.some((match) => match.label === 'Character: hero')).toBe(true);
        expect(matches.every((match) => match.filePath === '/project/data/characters.json')).toBe(true);
    });

    it('collects item matches and no-ops for empty records', () => {
        const populatedMatches: GlobalSearchMatch[] = [];
        const items: GlobalSearchProjectData['items'] = {
            badge: { description: 'hero item', name: 'Hero Badge' },
        };

        collectItemMatches(
            populatedMatches,
            'hero',
            items,
            { itemsPath: '/project/data/items.json' },
            resolveGlobalSearchTextOptions({}),
        );

        expect(populatedMatches.length).toBeGreaterThan(0);
        expect(populatedMatches.every((match) => match.kind === 'item')).toBe(true);
        expect(populatedMatches.some((match) => match.label === 'Item: badge')).toBe(true);

        const emptyMatches: GlobalSearchMatch[] = [];
        collectItemMatches(
            emptyMatches,
            'hero',
            {},
            { itemsPath: '/project/data/items.json' },
            resolveGlobalSearchTextOptions({}),
        );

        expect(emptyMatches).toEqual([]);
    });
});

describe('globalSearch script source search helpers', () => {
    it('collects scene matches only for scenes with manifest locations and array scripts', () => {
        const matches: GlobalSearchMatch[] = [];
        const scenes = {
            intro: [{ speaker: 'Narrator', text: 'hero appears', type: 'dialogue' }],
            invalid: { text: 'hero appears' } as never,
            missing: [{ speaker: 'Narrator', text: 'hero missing', type: 'dialogue' }],
        } as unknown as GlobalSearchProjectData['scenes'];
        const manifest = {
            scenes: {
                intro: 'scripts/intro.json',
                invalid: 'scripts/invalid.json',
            },
        };

        collectSceneMatches(matches, 'hero', scenes, manifest, '/project', resolveGlobalSearchTextOptions({}));

        expect(matches.length).toBeGreaterThan(0);
        expect(matches.every((match) => match.label.includes('intro'))).toBe(true);
        expect(matches.every((match) => match.filePath.endsWith('/scripts/intro.json'))).toBe(true);
    });

    it('collects macro matches in sorted name order with indexed body root paths', () => {
        const matches: GlobalSearchMatch[] = [];
        const macros: GlobalSearchProjectData['macros'] = {
            alpha: [{ speaker: 'Guide', text: 'hero alpha', type: 'dialogue' }],
            beta: [{ speaker: 'Guide', text: 'hero beta', type: 'dialogue' }],
        };

        collectMacroMatches(
            matches,
            'hero',
            macros,
            { macrosPath: '/project/data/macros.json' },
            resolveGlobalSearchTextOptions({}),
        );

        const textMatches = matches.filter((match) => match.valuePath?.includes('text'));
        expect(textMatches.some((match) => match.label === 'Macro: alpha' && match.valuePath?.[0] === 0)).toBe(true);
        expect(textMatches.some((match) => match.label === 'Macro: beta' && match.valuePath?.[0] === 1)).toBe(true);
        expect(textMatches.every((match) => match.valuePath?.[1] === 'body')).toBe(true);
    });
});

