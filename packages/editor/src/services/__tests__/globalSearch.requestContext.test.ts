import { describe, expect, it } from 'vitest';

import { createSearchRequestContext } from '../globalSearch/requestContext';

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

