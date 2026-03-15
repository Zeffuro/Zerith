import { describe, expect, it } from 'vitest';

import '../../test-utils/registerEditorServiceMocks';
import type { GlobalSearchMatch } from '../globalSearch/contracts';

import { createGlobalSearchProjectData } from '../../test-utils/projectDataBuilder';
import { formatScriptBranchLabel, SCRIPT_BRANCH_LABEL_SEPARATOR } from '../globalSearch/branchLabels';
import { deriveManifestFilePaths, deriveSceneFilePathMap } from '../globalSearch/manifestPaths';
import { getAtPath, setAtPath } from '../globalSearch/pathAccess';
import {
    formatInlineSceneLabel,
    formatMacroLabel,
    formatSceneLabel,
    resolveFilePath,
    resolveSceneLocation,
    toMacroName,
    toMacroRelativePath,
    toSceneName,
} from '../globalSearch/pathLabels';
import {
    CHARACTER_LABEL_PREFIX,
    formatRecordLabel,
    formatRecordSourceLabel,
    ITEM_LABEL_PREFIX,
    resolveRecordLabelPrefix,
} from '../globalSearch/recordLabels';
import { scanLeafStrings, scanRecordStringLeaves, scanScriptNodes } from '../globalSearch/scan';
import {
    findSearchMatchStart,
    matchesSearchValue,
    replaceSearchValue,
    resolveGlobalSearchTextOptions,
    summarizeMatchedText,
    toSearchExpression,
} from '../globalSearch/textSearch';

describe('globalSearch pathLabels helpers', () => {
    it('resolves file paths for relative, rooted, and fallback sources', () => {
        expect(resolveFilePath('/project', 'scripts/intro.json')).toBe('/project/scripts/intro.json');
        expect(resolveFilePath('/project', '/data/macros.json')).toBe('/project/data/macros.json');
        expect(resolveFilePath('/project', String.raw`\data\macros.json`)).toBe(String.raw`/project\data\macros.json`);
        expect(resolveFilePath('/project')).toBe('/project/game.json');
    });

    it('resolves scene locations with scene and inline labels, or undefined when missing', () => {
        expect(resolveSceneLocation('/project', 'intro', { intro: 'scripts/intro.json' })).toEqual({
            filePath: '/project/scripts/intro.json',
            label: 'Scene: intro',
        });
        expect(resolveSceneLocation('/project', 'intro', { intro: { inline: true } })).toEqual({
            filePath: '/project/game.json',
            label: 'Scene: intro (inline)',
        });
        expect(resolveSceneLocation('/project', 'missing', { intro: 'scripts/intro.json' })).toBeUndefined();
    });

    it('parses macro labels and macro relative paths only for valid prefixes/shapes', () => {
        expect(toMacroName('Macro: intro')).toBe('intro');
        expect(toMacroName('Scene: intro')).toBeUndefined();

        expect(toMacroRelativePath([0, 'body', 2, 'text'])).toEqual([2, 'text']);
        expect(toMacroRelativePath([0, 'not-body', 2, 'text'])).toBeUndefined();
        expect(toMacroRelativePath(['x', 'body', 2, 'text'] as never)).toBeUndefined();
    });

    it('parses scene labels while rejecting inline and non-scene labels', () => {
        expect(toSceneName('Scene: intro')).toBe('intro');
        expect(toSceneName('Scene: intro (inline)')).toBeUndefined();
        expect(toSceneName('Macro: intro')).toBeUndefined();
    });

    it('formats macro and scene labels that round-trip through parsing helpers', () => {
        expect(formatMacroLabel('intro')).toBe('Macro: intro');
        expect(toMacroName(formatMacroLabel('intro'))).toBe('intro');

        expect(formatSceneLabel('intro')).toBe('Scene: intro');
        expect(toSceneName(formatSceneLabel('intro'))).toBe('intro');

        expect(formatInlineSceneLabel('intro')).toBe('Scene: intro (inline)');
        expect(toSceneName(formatInlineSceneLabel('intro'))).toBeUndefined();
    });
});

describe('globalSearch textSearch helpers', () => {
    it('matches literal queries with optional case sensitivity', () => {
        const insensitive = resolveGlobalSearchTextOptions({ caseSensitive: false, regex: false });
        const sensitive = resolveGlobalSearchTextOptions({ caseSensitive: true, regex: false });

        expect(findSearchMatchStart('Alpha hero', 'HERO', insensitive)).toBe(6);
        expect(findSearchMatchStart('Alpha hero', 'HERO', sensitive)).toBe(-1);
        expect(matchesSearchValue('Alpha hero', 'hero', sensitive)).toBe(true);
    });

    it('supports regex matching and safely handles invalid regex patterns', () => {
        const regexOptions = resolveGlobalSearchTextOptions({ regex: true });
        expect(findSearchMatchStart('value-42', String.raw`value-\d+`, regexOptions)).toBe(0);

        const invalidRegex = toSearchExpression('(', regexOptions, false);
        expect(invalidRegex).toBeUndefined();
        expect(matchesSearchValue('value-42', '(', regexOptions)).toBe(false);
    });

    it('replaces all occurrences for literal and regex queries', () => {
        const literalOptions = resolveGlobalSearchTextOptions({});
        expect(replaceSearchValue('hero hero', 'hero', 'champion', literalOptions)).toBe('champion champion');

        const regexOptions = resolveGlobalSearchTextOptions({ regex: true });
        expect(replaceSearchValue('v1 v2 v3', String.raw`v\d`, 'token', regexOptions)).toBe('token token token');
    });

    it('summarizes long values around match window with ellipses', () => {
        const options = resolveGlobalSearchTextOptions({});
        const source = 'A'.repeat(90) + 'needle' + 'B'.repeat(90);

        const summarized = summarizeMatchedText(source, 'needle', options);
        expect(summarized.startsWith('...')).toBe(true);
        expect(summarized.endsWith('...')).toBe(true);
        expect(summarized.includes('needle')).toBe(true);
    });
});

describe('globalSearch pathAccess helpers', () => {
    it('reads nested values across object and array segments', () => {
        const target = {
            nodes: [{ text: 'hero appears' }],
        };

        expect(getAtPath(target, ['nodes', 0, 'text'])).toBe('hero appears');
    });

    it('returns undefined when a path segment does not resolve', () => {
        const target = {
            nodes: [{ text: 'hero appears' }],
        };

        expect(getAtPath(target, ['nodes', 1, 'text'])).toBeUndefined();
        expect(getAtPath(target, ['nodes', 'text'])).toBeUndefined();
    });

    it('writes nested values for valid paths', () => {
        const target = {
            nodes: [{ text: 'hero appears' }],
        };

        expect(setAtPath(target, ['nodes', 0, 'text'], 'champion appears')).toBe(true);
        expect(getAtPath(target, ['nodes', 0, 'text'])).toBe('champion appears');
    });

    it('returns false for invalid set paths', () => {
        const target = {
            nodes: [{ text: 'hero appears' }],
        };

        expect(setAtPath(target, [], 'value')).toBe(false);
        expect(setAtPath(target, ['nodes', 2, 'text'], 'value')).toBe(false);
        expect(setAtPath(target, ['nodes', 'text'], 'value')).toBe(false);
    });
});

describe('globalSearch scanLeafStrings helper', () => {
    it('recursively scans nested object/array leaves and records deep value paths', () => {
        const matches: GlobalSearchMatch[] = [];

        scanLeafStrings(matches, {
            basePath: ['root'],
            filePath: '/project/scripts/intro.json',
            kind: 'scene',
            label: 'Scene: intro',
            navigationPath: ['root'],
            query: 'hero',
            textOptions: resolveGlobalSearchTextOptions({}),
            value: {
                lines: [
                    { text: 'hero first line' },
                    { text: 'second line' },
                    { text: 'third hero line' },
                ],
                meta: {
                    note: 'hero note',
                },
            },
        });

        expect(matches.length).toBe(3);
        expect(matches.every((match) => match.path?.join('.') === 'root')).toBe(true);
        expect(matches.some((match) => match.valuePath?.join('.') === 'root.lines.0.text')).toBe(true);
        expect(matches.some((match) => match.valuePath?.join('.') === 'root.lines.2.text')).toBe(true);
        expect(matches.some((match) => match.valuePath?.join('.') === 'root.meta.note')).toBe(true);
    });

    it('keeps navigation path undefined when scanning non-navigable leaves', () => {
        const matches: GlobalSearchMatch[] = [];

        scanLeafStrings(matches, {
            basePath: ['payload'],
            filePath: '/project/data/items.json',
            kind: 'item',
            label: 'Item: badge',
            navigationPath: undefined,
            query: 'badge',
            textOptions: resolveGlobalSearchTextOptions({}),
            value: {
                tags: ['starter', 'badge token'],
            },
        });

        expect(matches).toHaveLength(1);
        expect(matches[0]?.path).toBeUndefined();
        expect(matches[0]?.valuePath?.join('.')).toBe('payload.tags.1');
    });
});

describe('globalSearch record label helpers', () => {
    it('exposes stable label prefixes for character and item sources', () => {
        expect(CHARACTER_LABEL_PREFIX).toBe('Character');
        expect(ITEM_LABEL_PREFIX).toBe('Item');
    });

    it('formats record labels with the shared prefix-entry pattern', () => {
        expect(formatRecordLabel(CHARACTER_LABEL_PREFIX, 'hero')).toBe('Character: hero');
        expect(formatRecordLabel(ITEM_LABEL_PREFIX, 'badge')).toBe('Item: badge');
    });

    it('resolves record label prefix from record kind', () => {
        expect(resolveRecordLabelPrefix('character')).toBe(CHARACTER_LABEL_PREFIX);
        expect(resolveRecordLabelPrefix('item')).toBe(ITEM_LABEL_PREFIX);
    });

    it('formats record labels directly from record kind', () => {
        expect(formatRecordSourceLabel('character', 'hero')).toBe('Character: hero');
        expect(formatRecordSourceLabel('item', 'badge')).toBe('Item: badge');
    });
});

describe('globalSearch branch label helpers', () => {
    it('exposes a stable branch label separator token', () => {
        expect(SCRIPT_BRANCH_LABEL_SEPARATOR).toBe(' > ');
    });

    it('formats parent and branch labels with stable separator', () => {
        expect(formatScriptBranchLabel('Scene: intro', 'If > then')).toBe('Scene: intro > If > then');
        expect(formatScriptBranchLabel('Macro: greet', 'Else')).toBe('Macro: greet > Else');
    });
});

describe('globalSearch manifest path helpers', () => {
    it('derives character/item/macro paths from manifest', () => {
        const projectData = createGlobalSearchProjectData();

        expect(deriveManifestFilePaths(projectData)).toEqual({
            charactersPath: '/project/data/characters.json',
            itemsPath: '/project/data/items.json',
            macrosPath: '/project/data/macros.json',
        });
    });

    it('falls back to game.json when manifest resource paths are missing', () => {
        const projectData = createGlobalSearchProjectData({
            manifest: {
                scenes: {
                    intro: 'scripts/intro.json',
                },
            },
        });

        expect(deriveManifestFilePaths(projectData)).toEqual({
            charactersPath: '/project/game.json',
            itemsPath: '/project/game.json',
            macrosPath: '/project/game.json',
        });
    });

    it('resolves rooted and relative scene file paths for known scene keys', () => {
        const projectData = createGlobalSearchProjectData({
            manifest: {
                characters: 'data/characters.json',
                items: 'data/items.json',
                macros: 'data/macros.json',
                scenes: {
                    inlineOnly: { inline: true },
                    intro: 'scripts/intro.json',
                    outro: '/scripts/outro.json',
                },
            },
            scenes: {
                intro: [{ speaker: 'Narrator', text: 'intro', type: 'dialogue' }],
                outro: [{ speaker: 'Narrator', text: 'outro', type: 'dialogue' }],
            },
        });

        expect(deriveSceneFilePathMap(projectData.scenes, projectData)).toEqual({
            intro: '/project/scripts/intro.json',
            outro: '/project/scripts/outro.json',
        });
    });
});

describe('globalSearch scan helpers', () => {
    it('scans script node string leaves with value paths', () => {
        const matches: GlobalSearchMatch[] = [];
        scanScriptNodes(matches, {
            filePath: '/project/scripts/intro.json',
            kind: 'scene',
            label: 'Scene: intro',
            query: 'hero',
            rootPath: [],
            script: [{ speaker: 'Narrator', text: 'hero appears', type: 'dialogue' }],
            textOptions: resolveGlobalSearchTextOptions({}),
        });

        const textMatch = matches.find((match) => match.valuePath?.join('.') === '0.text');
        expect(textMatch).toBeDefined();
        expect(textMatch?.kind).toBe('scene');
        expect(textMatch?.replaceable).toBe(true);
    });

    it('scans character/item records recursively and keeps entry navigation path', () => {
        const matches: GlobalSearchMatch[] = [];
        scanRecordStringLeaves(matches, {
            filePath: '/project/data/characters.json',
            kind: 'character',
            query: 'hero',
            textOptions: resolveGlobalSearchTextOptions({}),
            values: {
                hero: {
                    displayName: 'Hero',
                    meta: {
                        title: 'hero of justice',
                    },
                    name: 'hero',
                },
            },
        });

        expect(matches.length).toBeGreaterThan(0);
        expect(matches.every((match) => match.path?.[0] === 'hero')).toBe(true);
        expect(matches.some((match) => match.valuePath?.join('.') === 'hero.meta.title')).toBe(true);
    });
});

