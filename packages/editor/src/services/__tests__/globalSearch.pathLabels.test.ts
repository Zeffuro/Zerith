import { describe, expect, it } from 'vitest';

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

describe('globalSearch pathLabels helpers', () => {
    it('resolves file paths for relative, rooted, and fallback sources', () => {
        expect(resolveFilePath('/project', 'scripts/intro.json')).toBe('/project/scripts/intro.json');
        expect(resolveFilePath('/project', '/data/macros.json')).toBe('/project/data/macros.json');
        expect(resolveFilePath('/project', '\\data\\macros.json')).toBe('/project\\data\\macros.json');
        expect(resolveFilePath('/project', undefined)).toBe('/project/game.json');
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

