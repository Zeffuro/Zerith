import { describe, expect, it } from 'vitest';

import '../../test-utils/registerEditorServiceMocks';
import type { GlobalSearchMatch } from '../globalSearch/contracts';

import { createGlobalSearchProjectData } from '../../test-utils/projectDataBuilder';
import { replaceProjectContent, searchProjectContent } from '../globalSearch';
import { applyMatchReplacement } from '../globalSearch/replace';
import { toReplacementFilePayload } from '../globalSearch/replacementFiles';
import { resolveReplacementTarget } from '../globalSearch/replacementTargetResolver';
import { replaceProjectContent as replaceProjectContentFacade } from '../globalSearch/replaceService';
import { createSearchRequestContext } from '../globalSearch/requestContext';
import { searchProjectContent as searchProjectContentFacade } from '../globalSearch/searchService';
import { resolveGlobalSearchTextOptions } from '../globalSearch/textSearch';

const projectData = createGlobalSearchProjectData();

describe('globalSearch searchService facade', () => {
    it('returns matches for valid requests', () => {
        const localProjectData = createGlobalSearchProjectData();
        const matches = searchProjectContentFacade('hero', localProjectData);

        expect(matches.length).toBeGreaterThan(0);
        expect(matches.some((match) => match.kind === 'scene')).toBe(true);
    });

    it('returns no matches for invalid regex requests', () => {
        const localProjectData = createGlobalSearchProjectData();

        expect(searchProjectContentFacade('(', localProjectData, { regex: true })).toEqual([]);
    });

    it('returns no matches for whitespace-only queries', () => {
        const localProjectData = createGlobalSearchProjectData();

        expect(searchProjectContentFacade('   ', localProjectData)).toEqual([]);
    });
});

describe('globalSearch replaceService facade', () => {
    it('returns changed files for valid replacement requests', () => {
        const localProjectData = createGlobalSearchProjectData();
        const matches = searchProjectContentFacade('hero', localProjectData);
        const files = replaceProjectContentFacade('hero', 'champion', matches, localProjectData);

        expect(files.length).toBeGreaterThan(0);
        expect(files.some((file) => file.content.includes('champion'))).toBe(true);
    });

    it('returns no files when project path is missing', () => {
        const localProjectData = createGlobalSearchProjectData();
        const matches = searchProjectContentFacade('hero', localProjectData);

        expect(
            replaceProjectContentFacade('hero', 'champion', matches, {
                ...localProjectData,
                projectPath: undefined,
            }),
        ).toEqual([]);
    });

    it('returns no files for whitespace-only replacement queries', () => {
        const localProjectData = createGlobalSearchProjectData();

        expect(replaceProjectContentFacade('   ', 'champion', [], localProjectData)).toEqual([]);
    });
});

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

describe('globalSearch replace helpers', () => {
    it('applies replacements for macro and scene matches', () => {
        const data = createGlobalSearchProjectData();
        const textOptions = resolveGlobalSearchTextOptions({});

        const macroMatch: GlobalSearchMatch = {
            filePath: '/project/data/macros.json',
            kind: 'macro',
            label: 'Macro: greet',
            matchedValue: 'hello hero',
            path: [0, 'text'],
            preview: 'hello hero',
            replaceable: true,
            valuePath: [0, 'body', 0, 'text'],
        };
        const sceneMatch: GlobalSearchMatch = {
            filePath: '/project/scripts/intro.json',
            kind: 'scene',
            label: 'Scene: intro',
            matchedValue: 'hero appears',
            path: [0, 'text'],
            preview: 'hero appears',
            replaceable: true,
            valuePath: [0, 'text'],
        };

        const macroChanged = applyMatchReplacement({
            match: macroMatch,
            nextCharacters: structuredClone(data.characters),
            nextItems: structuredClone(data.items),
            nextMacros: data.macros,
            nextScenes: data.scenes,
            query: 'hero',
            replacement: 'champion',
            textOptions,
        });
        const sceneChanged = applyMatchReplacement({
            match: sceneMatch,
            nextCharacters: structuredClone(data.characters),
            nextItems: structuredClone(data.items),
            nextMacros: data.macros,
            nextScenes: data.scenes,
            query: 'hero',
            replacement: 'champion',
            textOptions,
        });

        expect(macroChanged).toBe(true);
        expect(sceneChanged).toBe(true);
        expect(data.macros.greet[0]?.text).toBe('hello champion');
        expect(data.scenes.intro[0]?.text).toBe('champion appears');
    });
});

describe('globalSearch replacement file helpers', () => {
    it('builds payload for character manifest path', () => {
        const localProjectData = createGlobalSearchProjectData();

        const payload = toReplacementFilePayload(
            '/project/data/characters.json',
            { hero: { displayName: 'Champion', name: 'hero' } },
            localProjectData.items,
            localProjectData.macros,
            localProjectData.scenes,
            localProjectData,
        );

        expect(payload?.kind).toBe('character');
        expect(payload?.filePath).toBe('/project/data/characters.json');
        expect(payload?.content.includes('Champion')).toBe(true);
    });

    it('builds payload for scene manifest path', () => {
        const localProjectData = createGlobalSearchProjectData();

        const payload = toReplacementFilePayload(
            '/project/scripts/intro.json',
            localProjectData.characters,
            localProjectData.items,
            localProjectData.macros,
            {
                intro: [{ speaker: 'Narrator', text: 'champion appears', type: 'dialogue' }],
            },
            localProjectData,
        );

        expect(payload?.kind).toBe('scene');
        expect(payload?.content.includes('champion appears')).toBe(true);
    });

    it('builds payload for item and macro manifest paths', () => {
        const localProjectData = createGlobalSearchProjectData();

        const itemPayload = toReplacementFilePayload(
            '/project/data/items.json',
            localProjectData.characters,
            {
                badge: {
                    description: 'refined item',
                    name: 'Refined Badge',
                },
            },
            localProjectData.macros,
            localProjectData.scenes,
            localProjectData,
        );

        const macroPayload = toReplacementFilePayload(
            '/project/data/macros.json',
            localProjectData.characters,
            localProjectData.items,
            {
                greet: [{ speaker: 'Guide', text: 'macro refined', type: 'dialogue' }],
            },
            localProjectData.scenes,
            localProjectData,
        );

        expect(itemPayload?.kind).toBe('item');
        expect(itemPayload?.content.includes('Refined Badge')).toBe(true);
        expect(macroPayload?.kind).toBe('macro');
        expect(macroPayload?.content.includes('macro refined')).toBe(true);
    });

    it('returns undefined for unmatched file path', () => {
        const localProjectData = createGlobalSearchProjectData();

        const payload = toReplacementFilePayload(
            '/project/unknown/path.json',
            localProjectData.characters,
            localProjectData.items,
            localProjectData.macros,
            localProjectData.scenes,
            localProjectData,
        );

        expect(payload).toBeUndefined();
    });

    it('returns undefined when scene manifest entry is not a file path', () => {
        const localProjectData = createGlobalSearchProjectData({
            manifest: {
                characters: 'data/characters.json',
                items: 'data/items.json',
                macros: 'data/macros.json',
                scenes: {
                    intro: { inline: true },
                },
            },
        });

        const payload = toReplacementFilePayload(
            '/project/scripts/intro.json',
            localProjectData.characters,
            localProjectData.items,
            localProjectData.macros,
            localProjectData.scenes,
            localProjectData,
        );

        expect(payload).toBeUndefined();
    });
});

describe('globalSearch replacement target resolver', () => {
    it('resolves character/item/macro manifest file paths', () => {
        const localProjectData = createGlobalSearchProjectData();

        expect(resolveReplacementTarget('/project/data/characters.json', localProjectData.scenes, localProjectData)).toEqual({
            kind: 'character',
        });
        expect(resolveReplacementTarget('/project/data/items.json', localProjectData.scenes, localProjectData)).toEqual({
            kind: 'item',
        });
        expect(resolveReplacementTarget('/project/data/macros.json', localProjectData.scenes, localProjectData)).toEqual({
            kind: 'macro',
        });
    });

    it('resolves scene file path to scene kind with name', () => {
        const localProjectData = createGlobalSearchProjectData();

        expect(resolveReplacementTarget('/project/scripts/intro.json', localProjectData.scenes, localProjectData)).toEqual({
            kind: 'scene',
            sceneName: 'intro',
        });
    });

    it('returns undefined when path does not map to known replacement source', () => {
        const localProjectData = createGlobalSearchProjectData();

        expect(resolveReplacementTarget('/project/unknown/path.json', localProjectData.scenes, localProjectData)).toBeUndefined();
    });

    it('returns undefined for inline scene manifest entries', () => {
        const localProjectData = createGlobalSearchProjectData({
            manifest: {
                characters: 'data/characters.json',
                items: 'data/items.json',
                macros: 'data/macros.json',
                scenes: {
                    intro: { inline: true },
                },
            },
        });

        expect(resolveReplacementTarget('/project/scripts/intro.json', localProjectData.scenes, localProjectData)).toBeUndefined();
    });
});

describe('globalSearch request context helpers', () => {
    it('normalizes query and resolves default text options', () => {
        const context = createSearchRequestContext('  hero  ', {});

        expect(context.normalizedQuery).toBe('hero');
        expect(context.resolvedTextOptions).toEqual({
            caseSensitive: false,
            regex: false,
        });
    });

    it('preserves explicit text option flags', () => {
        const context = createSearchRequestContext('hero', {
            caseSensitive: true,
            regex: true,
        });

        expect(context.normalizedQuery).toBe('hero');
        expect(context.resolvedTextOptions).toEqual({
            caseSensitive: true,
            regex: true,
        });
    });
});

