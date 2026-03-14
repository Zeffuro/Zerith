import { type RefObject } from 'react';

import { editorTheme as t } from '../../theme/editorTheme';
import { SettingsAppearancePanel } from './SettingsAppearancePanel';
import { type SettingsControlId } from './settingsControlRegistry';
import { SettingsEditorPanel } from './SettingsEditorPanel';
import { SettingsGeneralPanel } from './SettingsGeneralPanel';

type SettingsDetailPanelProperties = {
    autosaveEnabled: boolean;
    autosaveIntervalMs: number;
    changedControlIds: ReadonlySet<string>;
    detailContainerReference: RefObject<HTMLDivElement | null>;
    focusedControlId: SettingsControlId | undefined;
    isMuted: boolean;
    matchedControlIds: ReadonlySet<string>;
    onSetDetailRowReference: (controlId: SettingsControlId, element: HTMLDivElement | null) => void;
    panelId: string;
    searchQuery: string;
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
    autosaveEnabled,
    autosaveIntervalMs,
    changedControlIds,
    detailContainerReference,
    focusedControlId,
    isMuted,
    matchedControlIds,
    onSetDetailRowReference,
    panelId,
    searchQuery,
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
                    autosaveEnabled={autosaveEnabled}
                    autosaveIntervalMs={autosaveIntervalMs}
                    changedControlIds={changedControlIds}
                    focusedControlId={focusedControlId}
                    isMuted={isMuted}
                    matchedControlIds={matchedControlIds}
                    onSetDetailRowReference={onSetDetailRowReference}
                    panelId={panelId}
                    searchQuery={searchQuery}
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
                    focusedControlId={focusedControlId}
                    matchedControlIds={matchedControlIds}
                    onSetDetailRowReference={onSetDetailRowReference}
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

