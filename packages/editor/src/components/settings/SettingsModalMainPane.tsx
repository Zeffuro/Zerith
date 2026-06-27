import { X } from 'lucide-react';
import {
    type ComponentProps,
    type MouseEvent as ReactMouseEvent,
    type RefObject,
} from 'react';

import type { NonMacroEditorCommandType } from '../../plugins/types';
import type { CustomThemeEntry, DockLayoutPreset } from '../../store/settings/SettingsSchema';

import { editorTheme as t } from '../../theme/editorTheme';
import { type SettingsControlId } from './settingsControlRegistry';
import { SettingsDetailPanel } from './SettingsDetailPanel';
import { SettingsKeymapPanel } from './SettingsKeymapPanel';

export type SettingsModalMainPaneProperties = {
    activeDockLayoutPresetId: string | undefined;
    audiosheetShortcutTargetMode: 'cursor' | 'playhead';
    autosaveEnabled: boolean;
    autosaveIntervalMs: number;
    changedControlIds: ReadonlySet<string>;
    customThemes: CustomThemeEntry[];
    detailContainerReference: RefObject<HTMLDivElement | null>;
    dockLayoutPresets: DockLayoutPreset[];
    editorScale: number | undefined;
    explorerScale: number | undefined;
    focusedControlId: SettingsControlId | undefined;
    inspectorScale: number | undefined;
    isMuted: boolean;
    matchedControlIds: ReadonlySet<string>;
    moveQuickCommandType: (type: NonMacroEditorCommandType, direction: 'left' | 'right') => void;
    onAddCustomTheme: (theme: CustomThemeEntry) => void;
    onBeginDrag: (event: ReactMouseEvent<HTMLDivElement>) => void;
    onClose: () => void;
    onDeleteCustomTheme: (key: string) => void;
    onDeleteDockLayoutPreset: (id: string) => void;
    onLoadDockLayoutPreset: (presetId: string) => void;
    onRequestResetAllSettings: () => void;
    onRequestResetCurrentPanel: () => void;
    onResetDockLayoutToDefault: () => void;
    onSaveCurrentDockLayoutPreset: (name: string) => void;
    onSetDetailRowReference: (controlId: SettingsControlId, element: HTMLDivElement | null) => void;
    onSetShowChangedOnlySettings: (nextValue: boolean) => void;
    onUpdateCustomTheme: (key: string, updates: Partial<Omit<CustomThemeEntry, 'key'>>) => void;
    quickCommandTypes: NonMacroEditorCommandType[];
    searchQuery: string;
    selectedPanelId: string;
    setAudiosheetShortcutTargetMode: (mode: 'cursor' | 'playhead') => void;
    setAutosaveEnabled: (enabled: boolean) => void;
    setAutosaveIntervalMs: (intervalMs: number) => void;
    setEditorScale: (scale: number | undefined) => void;
    setExplorerScale: (scale: number | undefined) => void;
    setInspectorScale: (scale: number | undefined) => void;
    setThemeKey: (key: string) => void;
    setTimelineScale: (scale: number | undefined) => void;
    setUiScale: (scale: number) => void;
    showChangedOnlySettings: boolean;
    showKeymapPanel: boolean;
    themeKey: string;
    timelineScale: number | undefined;
    toggleMute: () => void;
    toggleQuickCommandType: (type: NonMacroEditorCommandType) => void;
    uiScale: number;
} & Pick<ComponentProps<typeof SettingsKeymapPanel>,
    | 'activeConflictIndex'
    | 'conflictActionSequenceLength'
    | 'conflictCount'
    | 'conflictEntries'
    | 'filteredKeymapRows'
    | 'focusedRowAction'
    | 'onFixAllConflicts'
    | 'onFocusActionRow'
    | 'onJumpToConflict'
    | 'onRequestResetAllDefaults'
    | 'onRequestResetShortcut'
    | 'onResolveConflictForAction'
    | 'onSetRowReference'
    | 'onSetShowCustomizedOnly'
    | 'onUpdateShortcut'
    | 'rowsContainerReference'
    | 'showCustomizedOnly'
>;

const panelDescriptions: Record<string, string> = {
    appearance: 'Theme and scale preferences.',
    'appearance-scale': 'Configure editor zoom and UI density.',
    'appearance-theme': 'Pick or customize a visual theme.',
    editor: 'Editor-wide behavior and code editing options.',
    'editor-behavior': 'Control editing and scripting behavior defaults.',
    'editor-monaco': 'Code editor features, fonts, and diagnostics.',
    general: 'Global runtime and project behavior.',
    'general-autosave': 'Autosave cadence and safe-save behavior.',
    'general-layout': 'Manage docked panel layout presets.',
    'general-playback': 'Playback defaults for preview and debugging.',
    'general-quickbuttons': 'Configure which timeline quick buttons are shown and how they are ordered.',
    keymap: 'Customize keyboard shortcuts by action.',
    plugins: 'Inspect registered editor plugin packages.',
};

export function SettingsModalMainPane({
    activeConflictIndex,
    activeDockLayoutPresetId,
    audiosheetShortcutTargetMode,
    autosaveEnabled,
    autosaveIntervalMs,
    changedControlIds,
    conflictActionSequenceLength,
    conflictCount,
    conflictEntries,
    customThemes,
    detailContainerReference,
    dockLayoutPresets,
    editorScale,
    explorerScale,
    filteredKeymapRows,
    focusedControlId,
    focusedRowAction,
    inspectorScale,
    isMuted,
    matchedControlIds,
    moveQuickCommandType,
    onAddCustomTheme,
    onBeginDrag,
    onClose,
    onDeleteCustomTheme,
    onDeleteDockLayoutPreset,
    onFixAllConflicts,
    onFocusActionRow,
    onJumpToConflict,
    onLoadDockLayoutPreset,
    onRequestResetAllDefaults,
    onRequestResetAllSettings,
    onRequestResetCurrentPanel,
    onRequestResetShortcut,
    onResetDockLayoutToDefault,
    onResolveConflictForAction,
    onSaveCurrentDockLayoutPreset,
    onSetDetailRowReference,
    onSetRowReference,
    onSetShowChangedOnlySettings,
    onSetShowCustomizedOnly,
    onUpdateCustomTheme,
    onUpdateShortcut,
    quickCommandTypes,
    rowsContainerReference,
    searchQuery,
    selectedPanelId,
    setAudiosheetShortcutTargetMode,
    setAutosaveEnabled,
    setAutosaveIntervalMs,
    setEditorScale,
    setExplorerScale,
    setInspectorScale,
    setThemeKey,
    setTimelineScale,
    setUiScale,
    showChangedOnlySettings,
    showCustomizedOnly,
    showKeymapPanel,
    themeKey,
    timelineScale,
    toggleMute,
    toggleQuickCommandType,
    uiScale,
}: SettingsModalMainPaneProperties) {
    const selectedDescription = panelDescriptions[selectedPanelId] ?? 'Settings panel in progress.';

    return (
        <section style={{ display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0 }}>
            <header
                onMouseDown={onBeginDrag}
                style={{
                    alignItems: 'center',
                    borderBottom: `1px solid ${t.border.subtle}`,
                    cursor: 'move',
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: `${12 * uiScale}px ${16 * uiScale}px`,
                    userSelect: 'none',
                }}
            >
                <div style={{ fontSize: `${15 * uiScale}px`, fontWeight: 700 }}>{selectedDescription}</div>
                <button
                    aria-label="Close settings"
                    data-settings-close="true"
                    onClick={onClose}
                    style={{
                        alignItems: 'center',
                        background: t.bg.popup,
                        border: `1px solid ${t.border.normal}`,
                        borderRadius: t.radius.md,
                        color: t.text.primary,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        height: `${24 * uiScale}px`,
                        justifyContent: 'center',
                        padding: 0,
                        width: `${24 * uiScale}px`,
                    }}
                >
                    <X size={14 * uiScale} />
                </button>
            </header>
            <div style={{ borderBottom: `1px solid ${t.border.subtle}`, padding: `${10 * uiScale}px ${16 * uiScale}px` }}>
                <div style={{ display: 'inline-flex', gap: `${8 * uiScale}px` }}>
                    <button
                        onClick={onRequestResetCurrentPanel}
                        style={{
                            background: t.bg.popup,
                            border: `1px solid ${t.border.normal}`,
                            borderRadius: t.radius.md,
                            color: t.text.primary,
                            cursor: 'pointer',
                            fontSize: `${12 * uiScale}px`,
                            padding: `${6 * uiScale}px ${10 * uiScale}px`,
                        }}
                    >
                        Reset Current Panel
                    </button>
                    <button
                        onClick={onRequestResetAllSettings}
                        style={{
                            background: t.bg.popup,
                            border: `1px solid ${t.border.normal}`,
                            borderRadius: t.radius.md,
                            color: t.text.primary,
                            cursor: 'pointer',
                            fontSize: `${12 * uiScale}px`,
                            padding: `${6 * uiScale}px ${10 * uiScale}px`,
                        }}
                    >
                        Reset All Settings
                    </button>
                </div>
                {showKeymapPanel ? undefined : (
                    <label style={{ alignItems: 'center', color: t.text.normal, display: 'inline-flex', fontSize: `${12 * uiScale}px`, gap: `${6 * uiScale}px`, marginLeft: `${10 * uiScale}px` }}>
                        <input
                            checked={showChangedOnlySettings}
                            onChange={(event) => onSetShowChangedOnlySettings(event.currentTarget.checked)}
                            type="checkbox"
                        />
                        Show changed only
                    </label>
                )}
            </div>
            {showKeymapPanel ? (
                <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
                    <SettingsKeymapPanel
                        activeConflictIndex={activeConflictIndex}
                        conflictActionSequenceLength={conflictActionSequenceLength}
                        conflictCount={conflictCount}
                        conflictEntries={conflictEntries}
                        filteredKeymapRows={filteredKeymapRows}
                        focusedRowAction={focusedRowAction}
                        onFixAllConflicts={onFixAllConflicts}
                        onFocusActionRow={onFocusActionRow}
                        onJumpToConflict={onJumpToConflict}
                        onRequestResetAllDefaults={onRequestResetAllDefaults}
                        onRequestResetShortcut={onRequestResetShortcut}
                        onResolveConflictForAction={onResolveConflictForAction}
                        onSetRowReference={onSetRowReference}
                        onSetShowCustomizedOnly={onSetShowCustomizedOnly}
                        onUpdateShortcut={onUpdateShortcut}
                        rowsContainerReference={rowsContainerReference}
                        showCustomizedOnly={showCustomizedOnly}
                        uiScale={uiScale}
                    />
                </div>
            ) : (
                <SettingsDetailPanel
                    activeDockLayoutPresetId={activeDockLayoutPresetId}
                    audiosheetShortcutTargetMode={audiosheetShortcutTargetMode}
                    autosaveEnabled={autosaveEnabled}
                    autosaveIntervalMs={autosaveIntervalMs}
                    changedControlIds={changedControlIds}
                    customThemes={customThemes}
                    detailContainerReference={detailContainerReference}
                    dockLayoutPresets={dockLayoutPresets}
                    editorScale={editorScale}
                    explorerScale={explorerScale}
                    focusedControlId={focusedControlId}
                    inspectorScale={inspectorScale}
                    isMuted={isMuted}
                    matchedControlIds={matchedControlIds}
                    moveQuickCommandType={moveQuickCommandType}
                    onAddCustomTheme={onAddCustomTheme}
                    onDeleteCustomTheme={onDeleteCustomTheme}
                    onDeleteDockLayoutPreset={onDeleteDockLayoutPreset}
                    onLoadDockLayoutPreset={onLoadDockLayoutPreset}
                    onResetDockLayoutToDefault={onResetDockLayoutToDefault}
                    onSaveCurrentDockLayoutPreset={onSaveCurrentDockLayoutPreset}
                    onSetDetailRowReference={onSetDetailRowReference}
                    onUpdateCustomTheme={onUpdateCustomTheme}
                    panelId={selectedPanelId}
                    quickCommandTypes={quickCommandTypes}
                    searchQuery={searchQuery}
                    setAudiosheetShortcutTargetMode={setAudiosheetShortcutTargetMode}
                    setAutosaveEnabled={setAutosaveEnabled}
                    setAutosaveIntervalMs={setAutosaveIntervalMs}
                    setEditorScale={setEditorScale}
                    setExplorerScale={setExplorerScale}
                    setInspectorScale={setInspectorScale}
                    setThemeKey={setThemeKey}
                    setTimelineScale={setTimelineScale}
                    setUiScale={setUiScale}
                    showChangedOnly={showChangedOnlySettings}
                    themeKey={themeKey}
                    timelineScale={timelineScale}
                    toggleMute={toggleMute}
                    toggleQuickCommandType={toggleQuickCommandType}
                    uiScale={uiScale}
                />
            )}
        </section>
    );
}

