import type { SettingsControlId } from './settingsControlRegistry';

export type SettingsResetActions = {
    resetAudio: () => void;
    resetAudiosheetShortcutTargetMode: () => void;
    resetAutosaveEnabled: () => void;
    resetAutosaveIntervalMs: () => void;
    resetCustomThemes: () => void;
    resetDockLayoutPresets: () => void;
    resetEditorScale: () => void;
    resetExplorerScale: () => void;
    resetInspectorScale: () => void;
    resetKeymapOverrides: () => void;
    resetQuickCommandTypes: () => void;
    resetTheme: () => void;
    resetTimelineScale: () => void;
    resetUiScale: () => void;
};

const controlResetActionById: Record<SettingsControlId, (actions: SettingsResetActions) => void> = {
    audio: (actions) => actions.resetAudio(),
    audiosheetShortcutTargetMode: (actions) => actions.resetAudiosheetShortcutTargetMode(),
    autosaveEnabled: (actions) => actions.resetAutosaveEnabled(),
    autosaveIntervalMs: (actions) => actions.resetAutosaveIntervalMs(),
    customThemes: (actions) => actions.resetCustomThemes(),
    dockLayoutPresets: (actions) => actions.resetDockLayoutPresets(),
    editorScale: (actions) => actions.resetEditorScale(),
    explorerScale: (actions) => actions.resetExplorerScale(),
    inspectorScale: (actions) => actions.resetInspectorScale(),
    quickCommandTypes: (actions) => actions.resetQuickCommandTypes(),
    theme: (actions) => actions.resetTheme(),
    timelineScale: (actions) => actions.resetTimelineScale(),
    uiScale: (actions) => actions.resetUiScale(),
};

export function runAllSettingsReset(actions: SettingsResetActions): void {
    actions.resetTheme();
    actions.resetCustomThemes();
    actions.resetUiScale();
    actions.resetTimelineScale();
    actions.resetInspectorScale();
    actions.resetExplorerScale();
    actions.resetEditorScale();
    actions.resetAutosaveEnabled();
    actions.resetAutosaveIntervalMs();
    actions.resetAudio();
    actions.resetAudiosheetShortcutTargetMode();
    actions.resetDockLayoutPresets();
    actions.resetQuickCommandTypes();
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

