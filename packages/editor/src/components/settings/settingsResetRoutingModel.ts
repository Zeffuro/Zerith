import type { SettingsControlId } from './settingsControlRegistry';

export type SettingsResetActions = {
    resetAudio: () => void;
    resetAutosaveEnabled: () => void;
    resetAutosaveIntervalMs: () => void;
    resetKeymapOverrides: () => void;
    resetTheme: () => void;
    resetUiScale: () => void;
};

const controlResetActionById: Record<SettingsControlId, (actions: SettingsResetActions) => void> = {
    audio: (actions) => actions.resetAudio(),
    autosaveEnabled: (actions) => actions.resetAutosaveEnabled(),
    autosaveIntervalMs: (actions) => actions.resetAutosaveIntervalMs(),
    theme: (actions) => actions.resetTheme(),
    uiScale: (actions) => actions.resetUiScale(),
};

export function runAllSettingsReset(actions: SettingsResetActions): void {
    actions.resetTheme();
    actions.resetUiScale();
    actions.resetAutosaveEnabled();
    actions.resetAutosaveIntervalMs();
    actions.resetAudio();
    actions.resetKeymapOverrides();
}

export function runCurrentPanelReset(
    selectedPanelId: string,
    getPanelSettingsControls: (panelId: string) => SettingsControlId[],
    actions: SettingsResetActions,
): void {
    if (selectedPanelId === 'keymap') {
        actions.resetKeymapOverrides();
        return;
    }

    for (const controlId of getPanelSettingsControls(selectedPanelId)) {
        controlResetActionById[controlId](actions);
    }
}

