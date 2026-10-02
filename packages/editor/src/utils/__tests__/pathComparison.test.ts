import { afterEach, describe, expect, it, vi } from 'vitest';

import { normalizePathForComparison } from '../pathComparison';

describe('normalizePathForComparison', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it.each([false, true])('normalizes separators and trailing separators (native: %s)', native => {
        expect(normalizePathForComparison('/Parent\\Game\\', native)).toBe('/Parent/Game');
        expect(normalizePathForComparison('/Parent/Game///', native)).toBe('/Parent/Game');
        expect(normalizePathForComparison('', native)).toBe('');
    });

    it.each([false, true])('keeps case-distinct POSIX files separate (native: %s)', native => {
        const first = normalizePathForComparison('/Parent/Game/scripts/Intro.json', native);
        const second = normalizePathForComparison('/Parent/Game/scripts/intro.json', native);

        expect(first).not.toBe(second);
    });

    it('retains filesystem roots while comparing drive-root case natively', () => {
        expect(normalizePathForComparison('/')).toBe('/');
        expect(normalizePathForComparison('F:/', true)).toBe('f:/');
        expect(normalizePathForComparison('F:\\', true)).toBe('f:/');
        expect(normalizePathForComparison('F:/', false)).toBe('F:/');
        expect(normalizePathForComparison('F:', true)).not.toBe(normalizePathForComparison('F:/', true));
    });

    it.each([
        [String.raw`F:\Projects\Game\scripts\Intro.json`, 'f:/projects/game/scripts/intro.json'],
        [String.raw`\\SERVER\Share\Game\scripts\Intro.json`, '//server/share/game/scripts/intro.json'],
    ])('matches case-varied native Windows paths: %s', (first, second) => {
        expect(normalizePathForComparison(first, true)).toBe(normalizePathForComparison(second, true));
    });

    it.each([
        ['F:/Projects/Game', 'f:/projects/game'],
        ['//SERVER/Share/Game', '//server/share/game'],
        ['browser://project/Game', 'browser://project/game'],
    ])('keeps browser paths case-sensitive: %s', (first, second) => {
        expect(normalizePathForComparison(first, false)).not.toBe(normalizePathForComparison(second, false));
    });

    it.each(['__TAURI__', '__TAURI_INTERNALS__'])('uses the native runtime default from %s', marker => {
        expect(normalizePathForComparison('F:/Projects/Game')).toBe('F:/Projects/Game');

        vi.stubGlobal(marker, {});
        expect(normalizePathForComparison('F:/Projects/Game')).toBe('f:/projects/game');
        expect(normalizePathForComparison('F:/Projects/Game', false)).toBe('F:/Projects/Game');
    });
});
