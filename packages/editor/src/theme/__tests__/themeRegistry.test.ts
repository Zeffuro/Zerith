import { describe, expect, it } from 'vitest';

import { getThemeRegistry, normalizeTheme } from '../themeRegistry';

describe('themeRegistry', () => {
    it('normalizes themes from module default exports', () => {
        const normalized = normalizeTheme({
            default: {
                key: 'night',
                label: 'Night',
                vars: { '--editor-bg-app': '#000000' },
            },
        });

        expect(normalized).toEqual({
            key: 'night',
            label: 'Night',
            vars: { '--editor-bg-app': '#000000' },
        });
    });

    it('returns undefined for malformed theme payloads', () => {
        expect(normalizeTheme('bad-data')).toBeUndefined();
        expect(normalizeTheme({ default: 0 })).toBeUndefined();
        expect(normalizeTheme({ default: { key: 'night', vars: {} } })).toBeUndefined();
        expect(normalizeTheme({ default: { label: 'Night', vars: {} } })).toBeUndefined();
        expect(normalizeTheme({ default: { key: 'night', label: 'Night', vars: [] } })).toBeUndefined();
        expect(normalizeTheme({ default: { key: 'night', label: 'Night', vars: 'bad' } })).toBeUndefined();
    });

    it('accepts direct theme objects without module wrappers', () => {
        const normalized = normalizeTheme({
            key: 'classicSoft',
            label: 'Classic Soft',
            vars: { '--editor-text-primary': '#111111' },
        });

        expect(normalized).toEqual({
            key: 'classicSoft',
            label: 'Classic Soft',
            vars: { '--editor-text-primary': '#111111' },
        });
    });

    it('returns sorted built-in themes', () => {
        const registry = getThemeRegistry();
        const labels = registry.map((theme) => theme.label);

        expect(labels).toEqual(labels.toSorted((a, b) => a.localeCompare(b)));
        expect(registry.some((theme) => theme.key === 'classic')).toBe(true);
    });
});

