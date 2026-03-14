import { describe, expect, it } from 'vitest';

import type { GlobalSearchMatch } from '../../../services/globalSearch';

import {
    cycleResultIndex,
    kindColor,
    makeMatchKey,
    normalizeActiveResultIndex,
    previewReplaceValue,
    summarizeText,
    toSearchExpression,
} from '../globalSearchPanelModel';

function makeMatch(overrides?: Partial<GlobalSearchMatch>): GlobalSearchMatch {
    return {
        filePath: '/project/scripts/intro.json',
        kind: 'scene',
        label: 'Intro',
        matchedValue: 'hero',
        path: [0],
        preview: 'hero enters the room',
        replaceable: true,
        valuePath: [0, 'text'],
        ...overrides,
    };
}

describe('globalSearchPanelModel', () => {
    it('cycles result index with wraparound in both directions', () => {
        expect(cycleResultIndex(-1, 3, 1)).toBe(0);
        expect(cycleResultIndex(-1, 3, -1)).toBe(2);
        expect(cycleResultIndex(2, 3, 1)).toBe(0);
        expect(cycleResultIndex(0, 3, -1)).toBe(2);
        expect(cycleResultIndex(0, 0, 1)).toBe(-1);
    });

    it('normalizes active index to an in-range value', () => {
        expect(normalizeActiveResultIndex(-1, 4)).toBe(0);
        expect(normalizeActiveResultIndex(4, 4)).toBe(3);
        expect(normalizeActiveResultIndex(2, 4)).toBe(2);
        expect(normalizeActiveResultIndex(2, 0)).toBe(-1);
    });

    it('builds search expressions for plain and regex modes', () => {
        const plain = toSearchExpression('a+b', { caseSensitive: false, regex: false }, true);
        expect(plain?.source).toBe(String.raw`a\+b`);
        expect(plain?.flags).toBe('gi');

        const regex = toSearchExpression('a+b', { caseSensitive: true, regex: true }, false);
        expect(regex?.source).toBe('a+b');
        expect(regex?.flags).toBe('');
    });

    it('returns undefined for invalid regex expressions', () => {
        expect(toSearchExpression('[unterminated', { caseSensitive: false, regex: true }, true)).toBeUndefined();
    });

    it('previews replacements and falls back to source on invalid expression', () => {
        expect(previewReplaceValue('hero and hero', 'hero', 'champion', { caseSensitive: true, regex: false }))
            .toBe('champion and champion');

        expect(previewReplaceValue('hero', '[unterminated', 'champion', { caseSensitive: false, regex: true }))
            .toBe('hero');
    });

    it('summarizes long text and keeps short text untouched', () => {
        const long = `${'x'.repeat(118)}abcd`;
        expect(summarizeText(long)).toBe(`${'x'.repeat(117)}...`);
        expect(summarizeText('short')).toBe('short');
    });

    it('builds stable match keys and kind colors', () => {
        const explicit = makeMatch();
        const fallback = makeMatch({ path: undefined, valuePath: undefined });

        expect(makeMatchKey(explicit, 1)).toBe('/project/scripts/intro.json-0.text-1');
        expect(makeMatchKey(fallback, 2)).toBe('/project/scripts/intro.json-root-2');

        expect(kindColor('scene')).toBe('#60a5fa');
        expect(kindColor('macro')).toBe('#a78bfa');
        expect(kindColor('character')).toBe('#34d399');
        expect(kindColor('item')).toBe('#fbbf24');
    });
});

