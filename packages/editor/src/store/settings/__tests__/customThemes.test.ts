import { beforeEach, describe, expect, it } from 'vitest';

import { useSettingsStore } from '../../useSettingsStore';
import { type CustomThemeEntry, defaultSettings } from '../SettingsSchema';

function makeTheme(overrides: Partial<CustomThemeEntry> = {}): CustomThemeEntry {
    return {
        baseThemeKey: 'classic',
        key: 'custom-1710500000',
        label: 'Courtroom Contrast',
        vars: {
            '--editor-bg-app': '#101010',
            '--editor-text-primary': '#ffffff',
        },
        ...overrides,
    };
}

describe('useSettingsStore customThemes', () => {
    beforeEach(() => {
        useSettingsStore.setState({ ...defaultSettings });
    });

    it('adds a custom theme', () => {
        const theme = makeTheme();

        useSettingsStore.getState().addCustomTheme(theme);

        expect(useSettingsStore.getState().customThemes).toEqual([theme]);
    });

    it("updates a custom theme's label and vars", () => {
        const theme = makeTheme();
        useSettingsStore.getState().addCustomTheme(theme);

        useSettingsStore.getState().updateCustomTheme(theme.key, {
            label: 'Courtroom Midnight',
            vars: {
                '--editor-bg-app': '#000000',
                '--editor-text-primary': '#e8e8e8',
            },
        });

        expect(useSettingsStore.getState().customThemes).toEqual([
            {
                ...theme,
                label: 'Courtroom Midnight',
                vars: {
                    '--editor-bg-app': '#000000',
                    '--editor-text-primary': '#e8e8e8',
                },
            },
        ]);
    });

    it('deletes a custom theme', () => {
        const target = makeTheme();
        const other = makeTheme({ key: 'custom-1710501111', label: 'Soft Light' });
        useSettingsStore.getState().addCustomTheme(target);
        useSettingsStore.getState().addCustomTheme(other);

        useSettingsStore.getState().deleteCustomTheme(target.key);

        expect(useSettingsStore.getState().customThemes).toEqual([other]);
    });

    it("falls back to 'classic' when deleting the active custom theme", () => {
        const activeTheme = makeTheme({ key: 'custom-active', label: 'Active Theme' });
        useSettingsStore.getState().addCustomTheme(activeTheme);
        useSettingsStore.getState().setThemeKey(activeTheme.key);

        useSettingsStore.getState().deleteCustomTheme(activeTheme.key);

        expect(useSettingsStore.getState().themeKey).toBe('classic');
        expect(useSettingsStore.getState().customThemes).toEqual([]);
    });
});

