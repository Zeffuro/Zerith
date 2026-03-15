import { describe, expect, it } from 'vitest';

import { getFullThemeRegistry, getThemeRegistry, isCustomTheme, normalizeTheme } from '../themeRegistry';

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

    it('appends custom themes after built-in themes sorted by label', () => {
        const registry = getFullThemeRegistry([
            { key: 'custom-b', label: 'Zulu', vars: { '--editor-bg-app': '#111111' } },
            { key: 'custom-a', label: 'Alpha', vars: { '--editor-bg-app': '#000000' } },
        ]);

        const builtInCount = getThemeRegistry().length;
        expect(registry.slice(0, builtInCount)).toEqual(getThemeRegistry());
        expect(registry.slice(builtInCount).map((theme) => theme.label)).toEqual(['Alpha', 'Zulu']);
    });

    it('detects custom keys with isCustomTheme', () => {
        const customThemes = [
            { key: 'custom-1', label: 'Custom One', vars: { '--editor-bg-app': '#000000' } },
        ];

        expect(isCustomTheme('custom-1', customThemes)).toBe(true);
        expect(isCustomTheme('classic', customThemes)).toBe(false);
    });
});

