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
        resetCheckForUpdatesOnStartup: vi.fn(() => {
            order.push('checkForUpdatesOnStartup');
        }),
        resetCodeEditorLargeText: vi.fn(() => {
            order.push('codeEditorLargeText');
        }),
        resetCodeEditorPlainTextComfort: vi.fn(() => {
            order.push('codeEditorPlainTextComfort');
        }),
        resetCodeEditorScreenReaderMode: vi.fn(() => {
            order.push('codeEditorScreenReaderMode');
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

    it('routes editor monaco panel reset through profile controls', () => {
        const order: string[] = [];
        const actions = createResetActions(order);

        runCurrentPanelReset('editor-monaco', getPanelSettingsControls, actions);

        expect(order).toEqual(['codeEditorLargeText', 'codeEditorPlainTextComfort', 'codeEditorScreenReaderMode']);
    });

    it('routes updates panel reset through startup update checks', () => {
        const order: string[] = [];
        const actions = createResetActions(order);

        runCurrentPanelReset('general-updates', getPanelSettingsControls, actions);

        expect(order).toEqual(['checkForUpdatesOnStartup']);
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
            'checkForUpdatesOnStartup',
            'audio',
            'audiosheetShortcutTargetMode',
            'codeEditorScreenReaderMode',
            'codeEditorPlainTextComfort',
            'codeEditorLargeText',
            'dockLayoutPresets',
            'quickCommandTypes',
            'keymap',
        ]);
    });
});

