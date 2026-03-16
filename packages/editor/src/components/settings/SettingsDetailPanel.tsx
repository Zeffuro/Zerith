import { type RefObject } from 'react';

import type { CustomThemeEntry } from '../../store/settings/SettingsSchema';

import { editorTheme as t } from '../../theme/editorTheme';
import { SettingsAppearancePanel } from './SettingsAppearancePanel';
import { type SettingsControlId } from './settingsControlRegistry';
import { SettingsEditorPanel } from './SettingsEditorPanel';
import { SettingsGeneralPanel } from './SettingsGeneralPanel';

type SettingsDetailPanelProperties = {
    audiosheetShortcutTargetMode: 'cursor' | 'playhead';
    autosaveEnabled: boolean;
    autosaveIntervalMs: number;
    changedControlIds: ReadonlySet<string>;
    customThemes: CustomThemeEntry[];
    detailContainerReference: RefObject<HTMLDivElement | null>;
    focusedControlId: SettingsControlId | undefined;
    isMuted: boolean;
    matchedControlIds: ReadonlySet<string>;
    onAddCustomTheme: (theme: CustomThemeEntry) => void;
    onDeleteCustomTheme: (key: string) => void;
    onSetDetailRowReference: (controlId: SettingsControlId, element: HTMLDivElement | null) => void;
    onUpdateCustomTheme: (key: string, updates: Partial<Omit<CustomThemeEntry, 'key'>>) => void;
    panelId: string;
    searchQuery: string;
    setAudiosheetShortcutTargetMode: (mode: 'cursor' | 'playhead') => void;
    setAutosaveEnabled: (enabled: boolean) => void;
    setAutosaveIntervalMs: (intervalMs: number) => void;
    setThemeKey: (key: string) => void;
    setUiScale: (scale: number) => void;
    showChangedOnly: boolean;
    themeKey: string;
    toggleMute: () => void;
    uiScale: number;
};

export function SettingsDetailPanel({
    audiosheetShortcutTargetMode,
    autosaveEnabled,
    autosaveIntervalMs,
    changedControlIds,
    customThemes,
    detailContainerReference,
    focusedControlId,
    isMuted,
    matchedControlIds,
    onAddCustomTheme,
    onDeleteCustomTheme,
    onSetDetailRowReference,
    onUpdateCustomTheme,
    panelId,
    searchQuery,
    setAudiosheetShortcutTargetMode,
    setAutosaveEnabled,
    setAutosaveIntervalMs,
    setThemeKey,
    setUiScale,
    showChangedOnly,
    themeKey,
    toggleMute,
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
                    audiosheetShortcutTargetMode={audiosheetShortcutTargetMode}
                    autosaveEnabled={autosaveEnabled}
                    autosaveIntervalMs={autosaveIntervalMs}
                    changedControlIds={changedControlIds}
                    focusedControlId={focusedControlId}
                    isMuted={isMuted}
                    matchedControlIds={matchedControlIds}
                    onSetDetailRowReference={onSetDetailRowReference}
                    panelId={panelId}
                    searchQuery={searchQuery}
                    setAudiosheetShortcutTargetMode={setAudiosheetShortcutTargetMode}
                    setAutosaveEnabled={setAutosaveEnabled}
                    setAutosaveIntervalMs={setAutosaveIntervalMs}
                    showChangedOnly={showChangedOnly}
                    toggleMute={toggleMute}
                    uiScale={uiScale}
                />
            ) : undefined}

            {panelId.startsWith('appearance') ? (
                <SettingsAppearancePanel
                    changedControlIds={changedControlIds}
                    customThemes={customThemes}
                    focusedControlId={focusedControlId}
                    matchedControlIds={matchedControlIds}
                    onAddCustomTheme={onAddCustomTheme}
                    onDeleteCustomTheme={onDeleteCustomTheme}
                    onSetDetailRowReference={onSetDetailRowReference}
                    onUpdateCustomTheme={onUpdateCustomTheme}
                    panelId={panelId}
                    searchQuery={searchQuery}
                    setThemeKey={setThemeKey}
                    setUiScale={setUiScale}
                    showChangedOnly={showChangedOnly}
                    themeKey={themeKey}
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

            {!panelId.startsWith('general') && !panelId.startsWith('appearance') && !panelId.startsWith('editor') ? (
                <div style={{ color: t.text.muted, fontSize: `${12 * uiScale}px` }}>
                    {showChangedOnly
                        ? 'No changed settings are visible in this panel for the current search.'
                        : `No settings in this panel match "${searchQuery.trim()}".`}
                </div>
            ) : undefined}
        </div>
    );
}

