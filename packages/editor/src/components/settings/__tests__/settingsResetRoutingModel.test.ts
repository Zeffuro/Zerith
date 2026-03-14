import { describe, expect, it, vi } from 'vitest';

import { getPanelSettingsControls } from '../settingsControlRegistry';
import { runAllSettingsReset, runCurrentPanelReset, type SettingsResetActions } from '../settingsResetRoutingModel';

function createResetActions(order: string[]): SettingsResetActions {
    return {
        resetAudio: vi.fn(() => {
            order.push('audio');
        }),
        resetAutosaveEnabled: vi.fn(() => {
            order.push('autosaveEnabled');
        }),
        resetAutosaveIntervalMs: vi.fn(() => {
            order.push('autosaveIntervalMs');
        }),
        resetKeymapOverrides: vi.fn(() => {
            order.push('keymap');
        }),
        resetTheme: vi.fn(() => {
            order.push('theme');
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
            'uiScale',
            'autosaveEnabled',
            'autosaveIntervalMs',
            'audio',
            'keymap',
        ]);
    });
});

