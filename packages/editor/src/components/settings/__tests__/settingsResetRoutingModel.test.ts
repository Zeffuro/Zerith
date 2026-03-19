import { describe, expect, it, vi } from 'vitest';

import { getPanelSettingsControls } from '../settingsControlRegistry';
import { runAllSettingsReset, runCurrentPanelReset, type SettingsResetActions } from '../settingsResetRoutingModel';

function createResetActions(order: string[]): SettingsResetActions {
    return {
        resetAudio: vi.fn(() => {
            order.push('audio');
        }),
        resetAudiosheetShortcutTargetMode: vi.fn(() => {
            order.push('audiosheetShortcutTargetMode');
        }),
        resetAutosaveEnabled: vi.fn(() => {
            order.push('autosaveEnabled');
        }),
        resetAutosaveIntervalMs: vi.fn(() => {
            order.push('autosaveIntervalMs');
        }),
        resetCustomThemes: vi.fn(() => {
            order.push('customThemes');
        }),
        resetDockLayoutPresets: vi.fn(() => {
            order.push('dockLayoutPresets');
        }),
        resetEditorScale: vi.fn(() => {
            order.push('editorScale');
        }),
        resetExplorerScale: vi.fn(() => {
            order.push('explorerScale');
        }),
        resetInspectorScale: vi.fn(() => {
            order.push('inspectorScale');
        }),
        resetKeymapOverrides: vi.fn(() => {
            order.push('keymap');
        }),
        resetQuickCommandTypes: vi.fn(() => {
            order.push('quickCommandTypes');
        }),
        resetTheme: vi.fn(() => {
            order.push('theme');
        }),
        resetTimelineScale: vi.fn(() => {
            order.push('timelineScale');
        }),
        resetUiScale: vi.fn(() => {
            order.push('uiScale');
        }),
    };
}

describe('settingsResetRoutingModel', () => {
    it('routes keymap panel reset directly to keymap action', () => {
        const order: string[] = [];
        const actions = createResetActions(order);

        runCurrentPanelReset('keymap', getPanelSettingsControls, actions);

        expect(order).toEqual(['keymap']);
    });

    it('routes panel reset using control registry controls', () => {
        const order: string[] = [];
        const actions = createResetActions(order);

        runCurrentPanelReset('general-autosave', getPanelSettingsControls, actions);

        expect(order).toEqual(['autosaveEnabled', 'autosaveIntervalMs']);
    });

    it('ignores unknown panels without throwing', () => {
        const order: string[] = [];
        const actions = createResetActions(order);

        runCurrentPanelReset('unknown-panel', getPanelSettingsControls, actions);

        expect(order).toEqual([]);
    });

    it('runs all-settings reset in stable action order', () => {
        const order: string[] = [];
        const actions = createResetActions(order);

        runAllSettingsReset(actions);

        expect(order).toEqual([
            'theme',
            'customThemes',
            'uiScale',
            'timelineScale',
            'inspectorScale',
            'explorerScale',
            'editorScale',
            'autosaveEnabled',
            'autosaveIntervalMs',
            'audio',
            'audiosheetShortcutTargetMode',
            'dockLayoutPresets',
            'quickCommandTypes',
            'keymap',
        ]);
    });
});

