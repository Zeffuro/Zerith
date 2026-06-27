import { describe, expect, it } from 'vitest';

import { registerEditorCommandType } from '../../../plugins/commandTypes';
import { defaultSettings, extractPersistedSettings, MIN_AUTOSAVE_INTERVAL_MS, sanitizeAutosaveInterval } from '../SettingsSchema';

function mergeSettings(value?: unknown) {
    return {
        ...defaultSettings,
        ...extractPersistedSettings(value),
    };
}

describe('SettingsSchema', () => {
    it('returns empty settings for malformed top-level persisted values', () => {
        expect(extractPersistedSettings('invalid')).toEqual({});
        expect(extractPersistedSettings(42)).toEqual({});
        expect(extractPersistedSettings(['autosaveEnabled'])).toEqual({});
    });

    it('returns defaults for invalid persisted values', () => {
        expect(mergeSettings()).toEqual(defaultSettings);
        expect(mergeSettings({ audiosheetShortcutTargetMode: 'invalid' })).toEqual(defaultSettings);
        expect(mergeSettings({ activeDockLayoutPresetId: ' '.repeat(3) })).toEqual(defaultSettings);
        expect(mergeSettings({ autosaveEnabled: 'yes' })).toEqual(defaultSettings);
        expect(mergeSettings({ autosaveIntervalMs: 0 })).toEqual(defaultSettings);
        expect(mergeSettings({ autosaveIntervalMs: Number.NaN })).toEqual(defaultSettings);
        expect(mergeSettings({ customThemes: 'invalid' })).toEqual(defaultSettings);
        expect(mergeSettings({ dockLayoutPresets: 'invalid' })).toEqual(defaultSettings);
        expect(mergeSettings({ isMuted: 'yes' })).toEqual(defaultSettings);
        expect(mergeSettings({ keymapOverrides: 'invalid' })).toEqual(defaultSettings);
        expect(mergeSettings({ recentProjects: 'invalid' })).toEqual(defaultSettings);
        expect(mergeSettings({ themeKey: '' })).toEqual(defaultSettings);
        expect(mergeSettings({ themeKey: ' '.repeat(3) })).toEqual(defaultSettings);
        expect(mergeSettings({ uiScale: 0 })).toEqual(defaultSettings);
        expect(mergeSettings({ uiScale: -1 })).toEqual(defaultSettings);
        expect(mergeSettings({ uiScale: Number.NaN })).toEqual(defaultSettings);
        expect(mergeSettings({ timelineScale: 0 })).toEqual(defaultSettings);
        expect(mergeSettings({ inspectorScale: -1 })).toEqual(defaultSettings);
        expect(mergeSettings({ explorerScale: Number.NaN })).toEqual(defaultSettings);
        expect(mergeSettings({ editorScale: 0 })).toEqual(defaultSettings);
        expect(mergeSettings({ windowState: { height: 200, width: 300, x: 0, y: 0 } })).toEqual(defaultSettings);
    });

    it('accepts autosave settings and normalizes interval values', () => {
        expect(mergeSettings({ autosaveEnabled: true })).toEqual({ ...defaultSettings, autosaveEnabled: true });
        expect(mergeSettings({ autosaveIntervalMs: 1250.9 })).toEqual({ ...defaultSettings, autosaveIntervalMs: 5000 });
        expect(mergeSettings({ autosaveIntervalMs: 9000.9 })).toEqual({ ...defaultSettings, autosaveIntervalMs: 9000 });
    });

    it('accepts audiosheet shortcut target mode', () => {
        expect(mergeSettings({ audiosheetShortcutTargetMode: 'playhead' })).toEqual({
            ...defaultSettings,
            audiosheetShortcutTargetMode: 'playhead',
        });
    });

    it('sanitizes autosave intervals by truncating and enforcing minimum', () => {
        expect(sanitizeAutosaveInterval(7000.99)).toBe(7000);
        expect(sanitizeAutosaveInterval(-100)).toBe(MIN_AUTOSAVE_INTERVAL_MS);
        expect(sanitizeAutosaveInterval(1)).toBe(MIN_AUTOSAVE_INTERVAL_MS);
    });

    it('accepts valid theme keys and trims persisted input', () => {
        expect(mergeSettings({ themeKey: 'classicSoft' })).toEqual({ ...defaultSettings, themeKey: 'classicSoft' });
        expect(mergeSettings({ themeKey: '  classicSoft  ' })).toEqual({ ...defaultSettings, themeKey: 'classicSoft' });
    });

    it('accepts valid uiScale values', () => {
        expect(mergeSettings({ uiScale: 1.25 })).toEqual({ ...defaultSettings, uiScale: 1.25 });
    });

    it('accepts per-component scale overrides', () => {
        expect(mergeSettings({ editorScale: 1.05, explorerScale: 1.2, inspectorScale: 0.9, timelineScale: 1.1 })).toEqual({
            ...defaultSettings,
            editorScale: 1.05,
            explorerScale: 1.2,
            inspectorScale: 0.9,
            timelineScale: 1.1,
        });
    });

    it('accepts valid isMuted values', () => {
        expect(mergeSettings({ isMuted: true })).toEqual({ ...defaultSettings, isMuted: true });
    });

    it('accepts and sanitizes quick command types', () => {
        expect(mergeSettings({ quickCommandTypes: [' dialogue ', 'wait', 'invalid', 'wait', 42] })).toEqual({
            ...defaultSettings,
            quickCommandTypes: ['dialogue', 'wait'],
        });

        expect(mergeSettings({ quickCommandTypes: [] })).toEqual(defaultSettings);
    });

    it('accepts registered plugin command types in quick commands', () => {
        registerEditorCommandType('vitest_plugin_quick_command');

        expect(mergeSettings({
            quickCommandTypes: ['wait', ' vitest_plugin_quick_command ', 'vitest_plugin_quick_command'],
        })).toEqual({
            ...defaultSettings,
            quickCommandTypes: ['wait', 'vitest_plugin_quick_command'],
        });
    });

    it('accepts and sanitizes customThemes entries', () => {
        expect(mergeSettings({
            customThemes: [
                {
                    baseThemeKey: ' classic ',
                    key: ' custom-2 ',
                    label: ' Midnight ',
                    vars: {
                        '--editor-bg-app': ' #050505 ',
                        '--editor-text-primary': '#f0f0f0',
                        '--invalid-empty': ' '.repeat(3),
                    },
                },
                {
                    key: 'custom-2',
                    label: 'Midnight Latest',
                    vars: { '--editor-bg-app': '#111111' },
                },
                {
                    key: 'bad',
                    label: '',
                    vars: { '--editor-bg-app': '#000000' },
                },
            ],
        })).toEqual({
            ...defaultSettings,
            customThemes: [
                {
                    key: 'custom-2',
                    label: 'Midnight Latest',
                    vars: { '--editor-bg-app': '#111111' },
                },
            ],
        });
    });

    it('accepts and sanitizes keymap overrides', () => {
        expect(mergeSettings({
            keymapOverrides: {
                save: ' Ctrl + K ',
                undo: '',
                unknownAction: 'x',
            },
        })).toEqual({
            ...defaultSettings,
            keymapOverrides: {
                save: 'mod+k',
            },
        });

        expect(mergeSettings({
            keymapOverrides: {
                openGlobalSearchFind: '  ',
                save: 'Ctrl+K',
                saveAll: 12,
            },
        })).toEqual({
            ...defaultSettings,
            keymapOverrides: {
                save: 'mod+k',
            },
        });
    });

    it('accepts and sanitizes recentProjects', () => {
        expect(mergeSettings({
            recentProjects: [
                { lastOpened: 3, name: 'A', path: '/a' },
                { lastOpened: 7, name: 'A Latest', path: '/a' },
                { lastOpened: 5, name: 'B', path: '/b' },
                { lastOpened: 'oops', name: 'Bad', path: '/bad' },
            ],
        })).toEqual({
            ...defaultSettings,
            recentProjects: [
                { lastOpened: 7, name: 'A Latest', path: '/a' },
                { lastOpened: 5, name: 'B', path: '/b' },
            ],
        });

        expect(mergeSettings({
            recentProjects: [
                { lastOpened: 2, name: '  Trimmed  ', path: ' /trim ' },
                { lastOpened: 4, name: 'Latest', path: '/trim' },
                { lastOpened: Number.POSITIVE_INFINITY, name: 'Bad', path: '/bad' },
            ],
        })).toEqual({
            ...defaultSettings,
            recentProjects: [
                { lastOpened: 4, name: 'Latest', path: '/trim' },
            ],
        });
    });

    it('accepts and sanitizes dock layout presets', () => {
        expect(mergeSettings({
            activeDockLayoutPresetId: ' layout-a ',
            dockLayoutPresets: [
                {
                    id: ' layout-a ',
                    layoutJson: { global: { splitterSize: 4 }, layout: { children: [], type: 'row' } },
                    name: ' Main Layout ',
                    updatedAt: 2.9,
                },
                {
                    id: 'layout-a',
                    layoutJson: { global: { splitterSize: 8 }, layout: { children: [], type: 'row' } },
                    name: 'Main Layout Latest',
                    updatedAt: 5,
                },
                {
                    id: 'bad',
                    layoutJson: { layout: { children: [], type: 'row' } },
                    name: 'Bad Layout',
                    updatedAt: 3,
                },
            ],
        })).toEqual({
            ...defaultSettings,
            activeDockLayoutPresetId: 'layout-a',
            dockLayoutPresets: [
                {
                    id: 'layout-a',
                    layoutJson: { global: { splitterSize: 8 }, layout: { children: [], type: 'row' } },
                    name: 'Main Layout Latest',
                    updatedAt: 5,
                },
            ],
        });
    });

    it('caps recentProjects to 12 after sanitization', () => {
        const input = Array.from({ length: 15 }, (_, index) => ({
            lastOpened: index,
            name: `P${index}`,
            path: `/p${index}`,
        }));

        const merged = mergeSettings({ recentProjects: input });

        expect(merged.recentProjects).toHaveLength(12);
        expect(merged.recentProjects[0]).toEqual({ lastOpened: 14, name: 'P14', path: '/p14' });
    });

    it('accepts valid windowState values', () => {
        const windowState = { height: 700, maximized: true, width: 1200, x: 10, y: 20 };
        expect(mergeSettings({ windowState })).toEqual({ ...defaultSettings, windowState });
    });

    it('extracts only valid persisted settings', () => {
        expect(extractPersistedSettings({ autosaveEnabled: true })).toEqual({ autosaveEnabled: true });
        expect(extractPersistedSettings({ activeDockLayoutPresetId: 'layout-a' })).toEqual({ activeDockLayoutPresetId: 'layout-a' });
        expect(extractPersistedSettings({ activeDockLayoutPresetId: '' })).toEqual({});
        expect(extractPersistedSettings({ audiosheetShortcutTargetMode: 'cursor' })).toEqual({ audiosheetShortcutTargetMode: 'cursor' });
        expect(extractPersistedSettings({ audiosheetShortcutTargetMode: 'bad' })).toEqual({});
        expect(extractPersistedSettings({ autosaveIntervalMs: 4500.5 })).toEqual({ autosaveIntervalMs: 5000 });
        expect(extractPersistedSettings({ autosaveIntervalMs: -1 })).toEqual({});
        expect(extractPersistedSettings({ isMuted: true })).toEqual({ isMuted: true });
        expect(extractPersistedSettings({ isMuted: 'yes' })).toEqual({});
        expect(extractPersistedSettings({ quickCommandTypes: ['wait', 'wait', 'unknown'] })).toEqual({ quickCommandTypes: ['wait'] });
        expect(extractPersistedSettings({ quickCommandTypes: ['unknown'] })).toEqual({});
        expect(extractPersistedSettings({ keymapOverrides: { save: 'ctrl+k', unknownAction: 'x' } }))
            .toEqual({ keymapOverrides: { save: 'mod+k' } });
        expect(extractPersistedSettings({ keymapOverrides: 'invalid' })).toEqual({});
        expect(extractPersistedSettings({ recentProjects: [{ lastOpened: 1.9, name: 'A', path: '/a' }] }))
            .toEqual({ recentProjects: [{ lastOpened: 1, name: 'A', path: '/a' }] });
        expect(extractPersistedSettings({ recentProjects: 'invalid' })).toEqual({});
        expect(extractPersistedSettings({
            customThemes: [{ key: 'custom-1', label: 'Custom 1', vars: { '--editor-bg-app': '#000000' } }],
        })).toEqual({
            customThemes: [{ key: 'custom-1', label: 'Custom 1', vars: { '--editor-bg-app': '#000000' } }],
        });
        expect(extractPersistedSettings({ customThemes: 'invalid' })).toEqual({});
        expect(extractPersistedSettings({
            dockLayoutPresets: [{ id: 'layout-a', layoutJson: { global: {}, layout: {} }, name: 'Layout A', updatedAt: 7 }],
        })).toEqual({
            dockLayoutPresets: [{ id: 'layout-a', layoutJson: { global: {}, layout: {} }, name: 'Layout A', updatedAt: 7 }],
        });
        expect(extractPersistedSettings({ dockLayoutPresets: 'invalid' })).toEqual({});
        expect(extractPersistedSettings({ themeKey: 'classicSoft' })).toEqual({ themeKey: 'classicSoft' });
        expect(extractPersistedSettings({ themeKey: '' })).toEqual({});
        expect(extractPersistedSettings({ uiScale: 1.5 })).toEqual({ uiScale: 1.5 });
        expect(extractPersistedSettings({ uiScale: 0 })).toEqual({});
        expect(extractPersistedSettings({ timelineScale: 1.3 })).toEqual({ timelineScale: 1.3 });
        expect(extractPersistedSettings({ timelineScale: 0 })).toEqual({});
        expect(extractPersistedSettings({ inspectorScale: 1.1 })).toEqual({ inspectorScale: 1.1 });
        expect(extractPersistedSettings({ explorerScale: 1.2 })).toEqual({ explorerScale: 1.2 });
        expect(extractPersistedSettings({ editorScale: 0 })).toEqual({});
        expect(extractPersistedSettings({ windowState: { height: 700, maximized: false, width: 1200, x: 10, y: 20 } }))
            .toEqual({ windowState: { height: 700, maximized: false, width: 1200, x: 10, y: 20 } });
        expect(extractPersistedSettings({ windowState: { height: 200, width: 300, x: 0, y: 0 } })).toEqual({});
    });
});

