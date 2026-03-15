export type PendingSettingsReset = {
    confirmText: string;
    danger?: boolean;
    message: string;
    onConfirm: () => void;
    title: string;
};

export function createResetAllKeymapOverridesConfirmation(onConfirm: () => void): PendingSettingsReset {
    return {
        confirmText: 'Reset Keymap',
        danger: true,
        message: 'Reset all keymap overrides to defaults?',
        onConfirm,
        title: 'Reset Keymap Overrides',
    };
}

export function createResetAllSettingsConfirmation(onConfirm: () => void): PendingSettingsReset {
    return {
        confirmText: 'Reset All',
        danger: true,
        message: 'Reset ALL settings to defaults? This includes keymap overrides.',
        onConfirm,
        title: 'Reset All Settings',
    };
}

export function createResetCurrentPanelConfirmation(onConfirm: () => void): PendingSettingsReset {
    return {
        confirmText: 'Reset Panel',
        danger: true,
        message: 'Reset settings in the current panel to defaults?',
        onConfirm,
        title: 'Reset Current Panel',
    };
}

export function createResetShortcutConfirmation(actionLabel: string, onConfirm: () => void): PendingSettingsReset {
    return {
        confirmText: 'Restore Default',
        danger: true,
        message: `Restore default shortcut for ${actionLabel}?`,
        onConfirm,
        title: 'Restore Shortcut Default',
    };
}

