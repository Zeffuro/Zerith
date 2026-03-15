import { describe, expect, it, vi } from 'vitest';

import {
    createResetAllKeymapOverridesConfirmation,
    createResetAllSettingsConfirmation,
    createResetCurrentPanelConfirmation,
    createResetShortcutConfirmation,
} from '../settingsResetConfirmModel';

describe('settingsResetConfirmModel', () => {
    it('builds current-panel reset confirmation metadata', () => {
        const onConfirm = vi.fn();
        const confirmation = createResetCurrentPanelConfirmation(onConfirm);

        expect(confirmation.title).toBe('Reset Current Panel');
        expect(confirmation.confirmText).toBe('Reset Panel');
        expect(confirmation.message).toBe('Reset settings in the current panel to defaults?');
        expect(confirmation.danger).toBe(true);

        confirmation.onConfirm();
        expect(onConfirm).toHaveBeenCalledTimes(1);
    });

    it('builds all-settings reset confirmation metadata', () => {
        const onConfirm = vi.fn();
        const confirmation = createResetAllSettingsConfirmation(onConfirm);

        expect(confirmation.title).toBe('Reset All Settings');
        expect(confirmation.confirmText).toBe('Reset All');
        expect(confirmation.message).toBe('Reset ALL settings to defaults? This includes keymap overrides.');
        expect(confirmation.danger).toBe(true);
    });

    it('builds keymap reset confirmation metadata', () => {
        const onConfirm = vi.fn();
        const confirmation = createResetAllKeymapOverridesConfirmation(onConfirm);

        expect(confirmation.title).toBe('Reset Keymap Overrides');
        expect(confirmation.confirmText).toBe('Reset Keymap');
        expect(confirmation.message).toBe('Reset all keymap overrides to defaults?');
        expect(confirmation.danger).toBe(true);
    });

    it('builds shortcut reset confirmation metadata with action label', () => {
        const confirmation = createResetShortcutConfirmation('Toggle Console', vi.fn());

        expect(confirmation.title).toBe('Restore Shortcut Default');
        expect(confirmation.confirmText).toBe('Restore Default');
        expect(confirmation.message).toBe('Restore default shortcut for Toggle Console?');
        expect(confirmation.danger).toBe(true);
    });
});

