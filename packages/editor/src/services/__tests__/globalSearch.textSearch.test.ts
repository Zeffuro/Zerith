import { describe, expect, it } from 'vitest';

import {
    findSearchMatchStart,
    matchesSearchValue,
    replaceSearchValue,
    resolveGlobalSearchTextOptions,
    summarizeMatchedText,
    toSearchExpression,
} from '../globalSearch/textSearch';

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
        expect(findSearchMatchStart('value-42', 'value-\\d+', regexOptions)).toBe(0);

        const invalidRegex = toSearchExpression('(', regexOptions, false);
        expect(invalidRegex).toBeUndefined();
        expect(matchesSearchValue('value-42', '(', regexOptions)).toBe(false);
    });

    it('replaces all occurrences for literal and regex queries', () => {
        const literalOptions = resolveGlobalSearchTextOptions({});
        expect(replaceSearchValue('hero hero', 'hero', 'champion', literalOptions)).toBe('champion champion');

        const regexOptions = resolveGlobalSearchTextOptions({ regex: true });
        expect(replaceSearchValue('v1 v2 v3', 'v\\d', 'token', regexOptions)).toBe('token token token');
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

