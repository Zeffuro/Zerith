import { type RefObject } from 'react';

import type { NonMacroEditorCommandType } from '../../plugins/types';
import type { CustomThemeEntry, DockLayoutPreset } from '../../store/settings/SettingsSchema';

import { editorTheme as t } from '../../theme/editorTheme';
import { SettingsAppearancePanel } from './SettingsAppearancePanel';
import { type SettingsControlId } from './settingsControlRegistry';
import { SettingsEditorPanel } from './SettingsEditorPanel';
import { SettingsGeneralPanel } from './SettingsGeneralPanel';
import { SettingsPluginPanel } from './SettingsPluginPanel';

type SettingsDetailPanelProperties = {
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
    onDeleteCustomTheme: (key: string) => void;
    onDeleteDockLayoutPreset: (id: string) => void;
    onLoadDockLayoutPreset: (presetId: string) => void;
    onResetDockLayoutToDefault: () => void;
    onSaveCurrentDockLayoutPreset: (name: string) => void;
    onSetDetailRowReference: (controlId: SettingsControlId, element: HTMLDivElement | null) => void;
    onUpdateCustomTheme: (key: string, updates: Partial<Omit<CustomThemeEntry, 'key'>>) => void;
    panelId: string;
    quickCommandTypes: NonMacroEditorCommandType[];
    searchQuery: string;
    setAudiosheetShortcutTargetMode: (mode: 'cursor' | 'playhead') => void;
    setAutosaveEnabled: (enabled: boolean) => void;
    setAutosaveIntervalMs: (intervalMs: number) => void;
    setEditorScale: (scale: number | undefined) => void;
    setExplorerScale: (scale: number | undefined) => void;
    setInspectorScale: (scale: number | undefined) => void;
    setThemeKey: (key: string) => void;
    setTimelineScale: (scale: number | undefined) => void;
    setUiScale: (scale: number) => void;
    showChangedOnly: boolean;
    themeKey: string;
    timelineScale: number | undefined;
    toggleMute: () => void;
    toggleQuickCommandType: (type: NonMacroEditorCommandType) => void;
    uiScale: number;
};

export function SettingsDetailPanel({
    activeDockLayoutPresetId,
    audiosheetShortcutTargetMode,
    autosaveEnabled,
    autosaveIntervalMs,
    changedControlIds,
    customThemes,
    detailContainerReference,
    dockLayoutPresets,
    editorScale,
    explorerScale,
    focusedControlId,
    inspectorScale,
    isMuted,
    matchedControlIds,
    moveQuickCommandType,
    onAddCustomTheme,
    onDeleteCustomTheme,
    onDeleteDockLayoutPreset,
    onLoadDockLayoutPreset,
    onResetDockLayoutToDefault,
    onSaveCurrentDockLayoutPreset,
    onSetDetailRowReference,
    onUpdateCustomTheme,
    panelId,
    quickCommandTypes,
    searchQuery,
    setAudiosheetShortcutTargetMode,
    setAutosaveEnabled,
    setAutosaveIntervalMs,
    setEditorScale,
    setExplorerScale,
    setInspectorScale,
    setThemeKey,
    setTimelineScale,
    setUiScale,
    showChangedOnly,
    themeKey,
    timelineScale,
    toggleMute,
    toggleQuickCommandType,
    uiScale,
}: SettingsDetailPanelProperties) {
    return (
        <div
            className="zerith-scrollbar"
            ref={detailContainerReference}
            style={{ display: 'grid', gap: `${12 * uiScale}px`, overflow: 'auto', overscrollBehavior: 'contain', padding: `${16 * uiScale}px` }}
        >
            {panelId.startsWith('general') ? (
                <SettingsGeneralPanel
                    activeDockLayoutPresetId={activeDockLayoutPresetId}
                    audiosheetShortcutTargetMode={audiosheetShortcutTargetMode}
                    autosaveEnabled={autosaveEnabled}
                    autosaveIntervalMs={autosaveIntervalMs}
                    changedControlIds={changedControlIds}
                    dockLayoutPresets={dockLayoutPresets}
                    focusedControlId={focusedControlId}
                    isMuted={isMuted}
                    matchedControlIds={matchedControlIds}
                    moveQuickCommandType={moveQuickCommandType}
                    onDeleteDockLayoutPreset={onDeleteDockLayoutPreset}
                    onLoadDockLayoutPreset={onLoadDockLayoutPreset}
                    onResetDockLayoutToDefault={onResetDockLayoutToDefault}
                    onSaveCurrentDockLayoutPreset={onSaveCurrentDockLayoutPreset}
                    onSetDetailRowReference={onSetDetailRowReference}
                    panelId={panelId}
                    quickCommandTypes={quickCommandTypes}
                    searchQuery={searchQuery}
                    setAudiosheetShortcutTargetMode={setAudiosheetShortcutTargetMode}
                    setAutosaveEnabled={setAutosaveEnabled}
                    setAutosaveIntervalMs={setAutosaveIntervalMs}
                    showChangedOnly={showChangedOnly}
                    toggleMute={toggleMute}
                    toggleQuickCommandType={toggleQuickCommandType}
                    uiScale={uiScale}
                />
            ) : undefined}

            {panelId.startsWith('appearance') ? (
                <SettingsAppearancePanel
                    changedControlIds={changedControlIds}
                    customThemes={customThemes}
                    editorScale={editorScale}
                    explorerScale={explorerScale}
                    focusedControlId={focusedControlId}
                    inspectorScale={inspectorScale}
                    matchedControlIds={matchedControlIds}
                    onAddCustomTheme={onAddCustomTheme}
                    onDeleteCustomTheme={onDeleteCustomTheme}
                    onSetDetailRowReference={onSetDetailRowReference}
                    onUpdateCustomTheme={onUpdateCustomTheme}
                    panelId={panelId}
                    searchQuery={searchQuery}
                    setEditorScale={setEditorScale}
                    setExplorerScale={setExplorerScale}
                    setInspectorScale={setInspectorScale}
                    setThemeKey={setThemeKey}
                    setTimelineScale={setTimelineScale}
                    setUiScale={setUiScale}
                    showChangedOnly={showChangedOnly}
                    themeKey={themeKey}
                    timelineScale={timelineScale}
                    uiScale={uiScale}
                />
            ) : undefined}

            {panelId.startsWith('editor') ? (
                <SettingsEditorPanel
                    panelId={panelId}
                    searchQuery={searchQuery}
                    showChangedOnly={showChangedOnly}
                    uiScale={uiScale}
                />
            ) : undefined}

            {panelId === 'plugins' ? (
                <SettingsPluginPanel uiScale={uiScale} />
            ) : undefined}

            {!panelId.startsWith('general') && !panelId.startsWith('appearance') && !panelId.startsWith('editor') && panelId !== 'plugins' ? (
                <div style={{ color: t.text.muted, fontSize: `${12 * uiScale}px` }}>
                    {showChangedOnly
                        ? 'No changed settings are visible in this panel for the current search.'
                        : `No settings in this panel match "${searchQuery.trim()}".`}
                </div>
            ) : undefined}
        </div>
    );
}

