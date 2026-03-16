import { describe, expect, it } from 'vitest';

import {
    getChangedSettingsControlIds,
    getChangedSettingsLeafPanelCounts,
    getMatchedSettingsControlIds,
    getMatchedSettingsPanelIds,
    getVisibleSettingsControls,
} from '../settingsControlRegistry';

const state = {
    audiosheetShortcutTargetMode: 'cursor' as const,
    autosaveEnabled: true,
    autosaveIntervalMs: 30_000,
    customThemes: [
        {
            baseThemeKey: 'classic',
            key: 'custom-courtroom-night',
            label: 'Courtroom Night',
            vars: { '--editor-bg-app': '#111111' },
        },
    ],
    isMuted: false,
    themeKey: 'classicSoft',
    uiScale: 1.2,
};

describe('settingsControlRegistry', () => {
    it('matches controls by textual query and live setting values', () => {
        expect([...getMatchedSettingsControlIds('classicsoft', state)]).toEqual(['theme']);
        expect([...getMatchedSettingsControlIds('30 seconds', state)]).toEqual(['autosaveIntervalMs']);
        expect([...getMatchedSettingsControlIds('unmuted', state)]).toEqual(['audio']);
        expect([...getMatchedSettingsControlIds('shortcut target cursor', state)]).toEqual(['audiosheetShortcutTargetMode']);
    });

    it('returns all controls for blank query', () => {
        const matched = [...getMatchedSettingsControlIds('   ', state)];

        expect(matched).toEqual(['audio', 'audiosheetShortcutTargetMode', 'autosaveEnabled', 'autosaveIntervalMs', 'customThemes', 'theme', 'uiScale']);
    });

    it('derives panel ids from matched controls', () => {
        expect([...getMatchedSettingsPanelIds('theme', state)].toSorted()).toEqual(['appearance', 'appearance-theme', 'general']);
    });

    it('returns panel-visible controls', () => {
        expect(getVisibleSettingsControls('appearance')).toEqual(['customThemes', 'theme', 'uiScale']);
        expect(getVisibleSettingsControls('general-autosave')).toEqual(['autosaveEnabled', 'autosaveIntervalMs']);
        expect(getVisibleSettingsControls('general-playback')).toEqual(['audio', 'audiosheetShortcutTargetMode']);
    });

    it('builds changed control counts by leaf panel', () => {
        const changedCounts = getChangedSettingsLeafPanelCounts(
            {
                audiosheetShortcutTargetMode: 'playhead',
                autosaveEnabled: false,
                autosaveIntervalMs: 60_000,
                customThemes: [],
                isMuted: true,
                themeKey: 'classic',
                uiScale: 1,
            },
            state,
        );

        expect(changedCounts).toEqual({
            'appearance-scale': 1,
            'appearance-theme': 2,
            'general-autosave': 2,
            'general-playback': 2,
        });
    });

    it('builds changed control id set', () => {
        const changedIds = getChangedSettingsControlIds(
            {
                audiosheetShortcutTargetMode: 'playhead',
                autosaveEnabled: false,
                autosaveIntervalMs: 60_000,
                customThemes: [],
                isMuted: true,
                themeKey: 'classic',
                uiScale: 1,
            },
            state,
        );

        expect([...changedIds].toSorted()).toEqual([
            'audio',
            'audiosheetShortcutTargetMode',
            'autosaveEnabled',
            'autosaveIntervalMs',
            'customThemes',
            'theme',
            'uiScale',
        ]);
    });
});

