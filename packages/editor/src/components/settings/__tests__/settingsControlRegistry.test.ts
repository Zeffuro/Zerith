import { describe, expect, it } from 'vitest';

import {
    getChangedSettingsControlIds,
    getChangedSettingsLeafPanelCounts,
    getMatchedSettingsControlIds,
    getMatchedSettingsPanelIds,
    getVisibleSettingsControls,
} from '../settingsControlRegistry';

const state = {
    activeDockLayoutPresetId: 'layout-a',
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
    dockLayoutPresets: [
        {
            id: 'layout-a',
            layoutJson: { global: { splitterSize: 4 }, layout: { children: [], type: 'row' } },
            name: 'Layout A',
            updatedAt: 1,
        },
    ],
    editorScale: undefined,
    explorerScale: undefined,
    inspectorScale: undefined,
    isMuted: false,
    quickCommandTypes: ['dialogue', 'wait'],
    themeKey: 'classicSoft',
    timelineScale: undefined,
    uiScale: 1.2,
};

describe('settingsControlRegistry', () => {
    it('matches controls by textual query and live setting values', () => {
        expect([...getMatchedSettingsControlIds('classicsoft', state)]).toEqual(['theme']);
        expect([...getMatchedSettingsControlIds('30 seconds', state)]).toEqual(['autosaveIntervalMs']);
        expect([...getMatchedSettingsControlIds('unmuted', state)]).toEqual(['audio']);
        expect([...getMatchedSettingsControlIds('shortcut target cursor', state)]).toEqual(['audiosheetShortcutTargetMode']);
        expect([...getMatchedSettingsControlIds('toolbar timeline dialogue', state)]).toEqual(['quickCommandTypes']);
        expect([...getMatchedSettingsControlIds('layout a', state)]).toEqual(['dockLayoutPresets']);
        expect([...getMatchedSettingsControlIds('inspector scale', state)]).toEqual(['inspectorScale']);
    });

    it('returns all controls for blank query', () => {
        const matched = [...getMatchedSettingsControlIds(' '.repeat(3), state)];

        expect(matched).toEqual(['audio', 'audiosheetShortcutTargetMode', 'autosaveEnabled', 'autosaveIntervalMs', 'customThemes', 'dockLayoutPresets', 'editorScale', 'explorerScale', 'inspectorScale', 'quickCommandTypes', 'theme', 'timelineScale', 'uiScale']);
    });

    it('derives panel ids from matched controls', () => {
        expect([...getMatchedSettingsPanelIds('theme', state)].toSorted()).toEqual(['appearance', 'appearance-theme', 'general']);
    });

    it('returns panel-visible controls', () => {
        expect(getVisibleSettingsControls('appearance')).toEqual(['customThemes', 'editorScale', 'explorerScale', 'inspectorScale', 'theme', 'timelineScale', 'uiScale']);
        expect(getVisibleSettingsControls('general-autosave')).toEqual(['autosaveEnabled', 'autosaveIntervalMs']);
        expect(getVisibleSettingsControls('general-layout')).toEqual(['dockLayoutPresets']);
        expect(getVisibleSettingsControls('general-playback')).toEqual(['audio', 'audiosheetShortcutTargetMode']);
        expect(getVisibleSettingsControls('general-quickbuttons')).toEqual(['quickCommandTypes']);
    });

    it('builds changed control counts by leaf panel', () => {
        const changedCounts = getChangedSettingsLeafPanelCounts(
            {
                activeDockLayoutPresetId: undefined,
                audiosheetShortcutTargetMode: 'playhead',
                autosaveEnabled: false,
                autosaveIntervalMs: 60_000,
                customThemes: [],
                dockLayoutPresets: [],
                editorScale: 1.1,
                explorerScale: 0.9,
                inspectorScale: 1.2,
                isMuted: true,
                quickCommandTypes: ['dialogue', 'choice'],
                themeKey: 'classic',
                timelineScale: 1.25,
                uiScale: 1,
            },
            state,
        );

        expect(changedCounts).toEqual({
            'appearance-scale': 5,
            'appearance-theme': 2,
            'general-autosave': 2,
            'general-layout': 1,
            'general-playback': 2,
            'general-quickbuttons': 1,
        });
    });

    it('builds changed control id set', () => {
        const changedIds = getChangedSettingsControlIds(
            {
                activeDockLayoutPresetId: undefined,
                audiosheetShortcutTargetMode: 'playhead',
                autosaveEnabled: false,
                autosaveIntervalMs: 60_000,
                customThemes: [],
                dockLayoutPresets: [],
                editorScale: 1.1,
                explorerScale: 0.9,
                inspectorScale: 1.2,
                isMuted: true,
                quickCommandTypes: ['dialogue', 'choice'],
                themeKey: 'classic',
                timelineScale: 1.25,
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
            'dockLayoutPresets',
            'editorScale',
            'explorerScale',
            'inspectorScale',
            'quickCommandTypes',
            'theme',
            'timelineScale',
            'uiScale',
        ]);
    });
});

