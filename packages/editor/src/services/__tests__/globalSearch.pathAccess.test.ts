import { describe, expect, it } from 'vitest';

import { getAtPath, setAtPath } from '../globalSearch/pathAccess';

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

