import { describe, expect, it } from 'vitest';

import {
    getChangedSettingsControlIds,
    getChangedSettingsLeafPanelCounts,
    getMatchedSettingsControlIds,
    getMatchedSettingsPanelIds,
    getVisibleSettingsControls,
} from '../settingsControlRegistry';

const state = {
    autosaveEnabled: true,
    autosaveIntervalMs: 30_000,
    isMuted: false,
    themeKey: 'classicSoft',
    uiScale: 1.2,
};

describe('settingsControlRegistry', () => {
    it('matches controls by textual query and live setting values', () => {
        expect([...getMatchedSettingsControlIds('classicsoft', state)]).toEqual(['theme']);
        expect([...getMatchedSettingsControlIds('30 seconds', state)]).toEqual(['autosaveIntervalMs']);
        expect([...getMatchedSettingsControlIds('unmuted', state)]).toEqual(['audio']);
    });

    it('returns all controls for blank query', () => {
        const matched = [...getMatchedSettingsControlIds('   ', state)];

        expect(matched).toEqual(['audio', 'autosaveEnabled', 'autosaveIntervalMs', 'theme', 'uiScale']);
    });

    it('derives panel ids from matched controls', () => {
        expect([...getMatchedSettingsPanelIds('theme', state)].toSorted()).toEqual(['appearance', 'appearance-theme', 'general']);
    });

    it('returns panel-visible controls', () => {
        expect(getVisibleSettingsControls('appearance')).toEqual(['theme', 'uiScale']);
        expect(getVisibleSettingsControls('general-autosave')).toEqual(['autosaveEnabled', 'autosaveIntervalMs']);
    });

    it('builds changed control counts by leaf panel', () => {
        const changedCounts = getChangedSettingsLeafPanelCounts(
            {
                autosaveEnabled: false,
                autosaveIntervalMs: 60_000,
                isMuted: true,
                themeKey: 'classic',
                uiScale: 1,
            },
            state,
        );

        expect(changedCounts).toEqual({
            'appearance-scale': 1,
            'appearance-theme': 1,
            'general-autosave': 2,
            'general-playback': 1,
        });
    });

    it('builds changed control id set', () => {
        const changedIds = getChangedSettingsControlIds(
            {
                autosaveEnabled: false,
                autosaveIntervalMs: 60_000,
                isMuted: true,
                themeKey: 'classic',
                uiScale: 1,
            },
            state,
        );

        expect([...changedIds].toSorted()).toEqual([
            'audio',
            'autosaveEnabled',
            'autosaveIntervalMs',
            'theme',
            'uiScale',
        ]);
    });
});

