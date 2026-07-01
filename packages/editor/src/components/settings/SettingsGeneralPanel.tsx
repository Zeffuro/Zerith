import { type CSSProperties, type ReactNode } from 'react';

import type { NonMacroEditorCommandType } from '../../plugins/types';
import type { DockLayoutPreset } from '../../store/settings/SettingsSchema';

import { getAllPlugins } from '../../plugins/commandPlugins';
import { editorTheme as t } from '../../theme/editorTheme';
import { BrowserEditorReadinessPanel } from './BrowserEditorReadinessPanel';
import { getVisibleSettingsControls, type SettingsControlId } from './settingsControlRegistry';

type SettingsGeneralPanelProperties = {
    activeDockLayoutPresetId: string | undefined;
    audiosheetShortcutTargetMode: 'cursor' | 'playhead';
    autosaveEnabled: boolean;
    autosaveIntervalMs: number;
    changedControlIds: ReadonlySet<string>;
    dockLayoutPresets: DockLayoutPreset[];
    focusedControlId: SettingsControlId | undefined;
    isMuted: boolean;
    matchedControlIds: ReadonlySet<string>;
    moveQuickCommandType: (type: NonMacroEditorCommandType, direction: 'left' | 'right') => void;
    onDeleteDockLayoutPreset: (id: string) => void;
    onLoadDockLayoutPreset: (presetId: string) => void;
    onResetDockLayoutToDefault: () => void;
    onSaveCurrentDockLayoutPreset: (name: string) => void;
    onSetDetailRowReference: (controlId: SettingsControlId, element: HTMLDivElement | null) => void;
    panelId: string;
    quickCommandTypes: NonMacroEditorCommandType[];
    searchQuery: string;
    setAudiosheetShortcutTargetMode: (mode: 'cursor' | 'playhead') => void;
    setAutosaveEnabled: (enabled: boolean) => void;
    setAutosaveIntervalMs: (intervalMs: number) => void;
    showChangedOnly: boolean;
    toggleMute: () => void;
    toggleQuickCommandType: (type: NonMacroEditorCommandType) => void;
    uiScale: number;
};

export function SettingsGeneralPanel({
    activeDockLayoutPresetId,
    audiosheetShortcutTargetMode,
    autosaveEnabled,
    autosaveIntervalMs,
    changedControlIds,
    dockLayoutPresets,
    focusedControlId,
    isMuted,
    matchedControlIds,
    moveQuickCommandType,
    onDeleteDockLayoutPreset,
    onLoadDockLayoutPreset,
    onResetDockLayoutToDefault,
    onSaveCurrentDockLayoutPreset,
    onSetDetailRowReference,
    panelId,
    quickCommandTypes,
    searchQuery,
    setAudiosheetShortcutTargetMode,
    setAutosaveEnabled,
    setAutosaveIntervalMs,
    showChangedOnly,
    toggleMute,
    toggleQuickCommandType,
    uiScale,
}: SettingsGeneralPanelProperties) {
    const visibleControlIds = new Set(getVisibleSettingsControls(panelId));
    const quickCommandPlugins = getAllPlugins();
    const autosaveIntervalSeconds = Math.max(5, Math.round(autosaveIntervalMs / 1000));
    const autosaveIntervalLabel = `Autosave interval: ${autosaveIntervalSeconds}s`;

    const autosaveChanged = changedControlIds.has('autosaveEnabled');
    const autosaveIntervalChanged = changedControlIds.has('autosaveIntervalMs');
    const audioChanged = changedControlIds.has('audio');
    const audiosheetShortcutTargetModeChanged = changedControlIds.has('audiosheetShortcutTargetMode');
    const dockLayoutPresetsChanged = changedControlIds.has('dockLayoutPresets');
    const quickCommandTypesChanged = changedControlIds.has('quickCommandTypes');

    const showAutosaveRow = visibleControlIds.has('autosaveEnabled') && matchedControlIds.has('autosaveEnabled') && (!showChangedOnly || autosaveChanged);
    const showAutosaveIntervalRow = visibleControlIds.has('autosaveIntervalMs') && matchedControlIds.has('autosaveIntervalMs') && (!showChangedOnly || autosaveIntervalChanged);
    const showAudioRow = visibleControlIds.has('audio') && matchedControlIds.has('audio') && (!showChangedOnly || audioChanged);
    const showAudiosheetShortcutTargetModeRow =
        visibleControlIds.has('audiosheetShortcutTargetMode')
        && matchedControlIds.has('audiosheetShortcutTargetMode')
        && (!showChangedOnly || audiosheetShortcutTargetModeChanged);
    const showDockLayoutPresetsRow =
        visibleControlIds.has('dockLayoutPresets')
        && matchedControlIds.has('dockLayoutPresets')
        && (!showChangedOnly || dockLayoutPresetsChanged);
    const showQuickCommandTypesRow =
        visibleControlIds.has('quickCommandTypes')
        && matchedControlIds.has('quickCommandTypes')
        && (!showChangedOnly || quickCommandTypesChanged);
    const normalizedSearchQuery = searchQuery.trim().toLowerCase();
    const showBrowserEditorReadiness = panelId === 'general'
        && !showChangedOnly
        && (
            normalizedSearchQuery.length === 0
            || 'browser editor parity filesystem export desktop integrations loose output'.includes(normalizedSearchQuery)
        );

    if (!showBrowserEditorReadiness && !showAutosaveRow && !showAutosaveIntervalRow && !showAudioRow && !showAudiosheetShortcutTargetModeRow && !showDockLayoutPresetsRow && !showQuickCommandTypesRow) {
        return (
            <div style={{ color: t.text.muted, fontSize: `${12 * uiScale}px` }}>
                {showChangedOnly
                    ? 'No changed settings are visible in this panel for the current search.'
                    : `No settings in this panel match "${searchQuery.trim()}".`}
            </div>
        );
    }

    return (
        <>
            {showBrowserEditorReadiness ? (
                <BrowserEditorReadinessPanel uiScale={uiScale} />
            ) : undefined}

            {showAutosaveRow ? (
                <>
                    <EditableSettingRow
                        controlId="autosaveEnabled"
                        isChanged={autosaveChanged}
                        isFocused={focusedControlId === 'autosaveEnabled'}
                        label="Autosave"
                            onSetDetailRowReference={onSetDetailRowReference}
                        uiScale={uiScale}
                    >
                        <label style={{ alignItems: 'center', color: t.text.primary, display: 'inline-flex', fontSize: `${12 * uiScale}px`, gap: `${6 * uiScale}px` }}>
                            <input
                                checked={autosaveEnabled}
                                onChange={(event) => setAutosaveEnabled(event.currentTarget.checked)}
                                type="checkbox"
                            />
                            Enable autosave
                        </label>
                    </EditableSettingRow>

                    {showAutosaveIntervalRow ? (
                        <EditableSettingRow
                            controlId="autosaveIntervalMs"
                            isChanged={autosaveIntervalChanged}
                            isFocused={focusedControlId === 'autosaveIntervalMs'}
                            label={autosaveIntervalLabel}
                            onSetDetailRowReference={onSetDetailRowReference}
                            uiScale={uiScale}
                        >
                            <input
                                min={5}
                                onChange={(event) => setAutosaveIntervalMs(Number(event.currentTarget.value) * 1000)}
                                step={1}
                                style={settingsInputStyle(uiScale)}
                                type="number"
                                value={autosaveIntervalSeconds}
                            />
                        </EditableSettingRow>
                    ) : undefined}
                </>
            ) : (showAutosaveIntervalRow ? (
                <EditableSettingRow
                    controlId="autosaveIntervalMs"
                    isChanged={autosaveIntervalChanged}
                    isFocused={focusedControlId === 'autosaveIntervalMs'}
                    label={autosaveIntervalLabel}
                    onSetDetailRowReference={onSetDetailRowReference}
                    uiScale={uiScale}
                >
                    <input
                        min={5}
                        onChange={(event) => setAutosaveIntervalMs(Number(event.currentTarget.value) * 1000)}
                        step={1}
                        style={settingsInputStyle(uiScale)}
                        type="number"
                        value={autosaveIntervalSeconds}
                    />
                </EditableSettingRow>
            ) : undefined)}

            {showAudioRow ? (
                <EditableSettingRow
                    controlId="audio"
                    isChanged={audioChanged}
                    isFocused={focusedControlId === 'audio'}
                    label="Audio"
                    onSetDetailRowReference={onSetDetailRowReference}
                    uiScale={uiScale}
                >
                    <label style={{ alignItems: 'center', color: t.text.primary, display: 'inline-flex', fontSize: `${12 * uiScale}px`, gap: `${6 * uiScale}px` }}>
                        <input
                            checked={!isMuted}
                            onChange={(event) => {
                                const nextUnmuted = event.currentTarget.checked;
                                if (nextUnmuted === !isMuted) return;
                                toggleMute();
                            }}
                            type="checkbox"
                        />
                        Unmuted
                    </label>
                </EditableSettingRow>
            ) : undefined}

            {showAudiosheetShortcutTargetModeRow ? (
                <EditableSettingRow
                    controlId="audiosheetShortcutTargetMode"
                    isChanged={audiosheetShortcutTargetModeChanged}
                    isFocused={focusedControlId === 'audiosheetShortcutTargetMode'}
                    label="Audiosheet Q/E Target"
                    onSetDetailRowReference={onSetDetailRowReference}
                    uiScale={uiScale}
                >
                    <select
                        onChange={(event) => setAudiosheetShortcutTargetMode(event.currentTarget.value as 'cursor' | 'playhead')}
                        style={settingsInputStyle(uiScale)}
                        value={audiosheetShortcutTargetMode}
                    >
                        <option value="cursor">Cursor position</option>
                        <option value="playhead">Playhead position</option>
                    </select>
                </EditableSettingRow>
            ) : undefined}

            {showQuickCommandTypesRow ? (
                <EditableSettingRow
                    controlId="quickCommandTypes"
                    isChanged={quickCommandTypesChanged}
                    isFocused={focusedControlId === 'quickCommandTypes'}
                    label="Quick Buttons"
                    onSetDetailRowReference={onSetDetailRowReference}
                    uiScale={uiScale}
                >
                    <div style={{ display: 'grid', gap: `${6 * uiScale}px` }}>
                        {quickCommandPlugins.map((plugin) => {
                            const isActive = quickCommandTypes.includes(plugin.type);
                            return (
                                <div
                                    key={plugin.type}
                                    style={{
                                        alignItems: 'center',
                                        background: isActive ? t.bg.hover : 'transparent',
                                        borderRadius: t.radius.sm,
                                        display: 'grid',
                                        gap: `${6 * uiScale}px`,
                                        gridTemplateColumns: '1fr auto auto auto',
                                        padding: `${6 * uiScale}px`,
                                    }}
                                >
                                    <button
                                        onClick={() => toggleQuickCommandType(plugin.type)}
                                        style={{
                                            alignItems: 'center',
                                            background: 'transparent',
                                            border: 'none',
                                            color: isActive ? t.text.primary : t.text.muted,
                                            cursor: 'pointer',
                                            display: 'inline-flex',
                                            gap: `${8 * uiScale}px`,
                                            padding: 0,
                                            textAlign: 'left',
                                        }}
                                        type="button"
                                    >
                                        {plugin.icon(14 * uiScale)}
                                        <span>{plugin.label}</span>
                                        <span style={{ color: t.text.faint, fontSize: `${11 * uiScale}px` }}>({plugin.type})</span>
                                    </button>
                                    <button
                                        disabled={!isActive}
                                        onClick={() => moveQuickCommandType(plugin.type, 'left')}
                                        style={quickMoveButtonStyle(isActive, uiScale)}
                                        title="Move left"
                                        type="button"
                                    >
                                        {'<'}
                                    </button>
                                    <button
                                        disabled={!isActive}
                                        onClick={() => moveQuickCommandType(plugin.type, 'right')}
                                        style={quickMoveButtonStyle(isActive, uiScale)}
                                        title="Move right"
                                        type="button"
                                    >
                                        {'>'}
                                    </button>
                                    <span style={{ color: isActive ? t.accent.green : t.text.faint, fontSize: `${11 * uiScale}px` }}>
                                        {isActive ? 'ON' : 'OFF'}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </EditableSettingRow>
            ) : undefined}

            {showDockLayoutPresetsRow ? (
                <EditableSettingRow
                    controlId="dockLayoutPresets"
                    isChanged={dockLayoutPresetsChanged}
                    isFocused={focusedControlId === 'dockLayoutPresets'}
                    label="Dock Layout"
                    onSetDetailRowReference={onSetDetailRowReference}
                    uiScale={uiScale}
                >
                    <div style={{ display: 'grid', gap: `${8 * uiScale}px` }}>
                        <div style={{ display: 'grid', gap: `${6 * uiScale}px`, gridTemplateColumns: '1fr auto auto auto' }}>
                            <select
                                onChange={(event) => onLoadDockLayoutPreset(event.currentTarget.value)}
                                style={settingsInputStyle(uiScale)}
                                value={activeDockLayoutPresetId ?? ''}
                            >
                                <option value="">Current (unsaved)</option>
                                {dockLayoutPresets.map((preset) => (
                                    <option key={preset.id} value={preset.id}>{preset.name}</option>
                                ))}
                            </select>
                            <button
                                onClick={() => {
                                    const nextName = globalThis.prompt('Save current layout as preset', 'My Layout')?.trim();
                                    if (!nextName) return;
                                    onSaveCurrentDockLayoutPreset(nextName);
                                }}
                                style={settingsActionButtonStyle(uiScale)}
                                type="button"
                            >
                                Save Layout
                            </button>
                            <button
                                disabled={!activeDockLayoutPresetId}
                                onClick={() => {
                                    if (!activeDockLayoutPresetId) return;
                                    onDeleteDockLayoutPreset(activeDockLayoutPresetId);
                                }}
                                style={settingsActionButtonStyle(uiScale)}
                                type="button"
                            >
                                Delete
                            </button>
                            <button
                                onClick={onResetDockLayoutToDefault}
                                style={settingsActionButtonStyle(uiScale)}
                                type="button"
                            >
                                Reset to Default
                            </button>
                        </div>
                        <span style={{ color: t.text.muted, fontSize: `${11 * uiScale}px` }}>
                            Save the current panel arrangement, switch presets, or return to the default layout.
                        </span>
                    </div>
                </EditableSettingRow>
            ) : undefined}
        </>
    );
}

function EditableSettingRow({
    children,
    controlId,
    isChanged = false,
    isFocused = false,
    label,
    onSetDetailRowReference,
    uiScale,
}: {
    children: ReactNode;
    controlId: SettingsControlId;
    isChanged?: boolean;
    isFocused?: boolean;
    label: string;
    onSetDetailRowReference: (controlId: SettingsControlId, element: HTMLDivElement | null) => void;
    uiScale: number;
}) {
    return (
        <div
            ref={(element) => {
                onSetDetailRowReference(controlId, element);
            }}
            style={{
                alignItems: 'center',
                background: isChanged ? t.bg.selected : t.bg.popup,
                border: `1px solid ${isChanged ? t.border.accent : t.border.subtle}`,
                borderRadius: t.radius.md,
                boxShadow: isFocused ? `0 0 0 2px ${t.accent.primary}` : undefined,
                display: 'grid',
                gap: `${8 * uiScale}px`,
                gridTemplateColumns: `${170 * uiScale}px auto 1fr`,
                padding: `${10 * uiScale}px ${12 * uiScale}px`,
            }}
        >
            <span style={{ color: t.text.normal, fontSize: `${12 * uiScale}px` }}>{label}</span>
            <span
                style={{
                    alignItems: 'center',
                    background: t.accent.green,
                    borderRadius: t.radius.sm,
                    color: '#fff',
                    display: 'inline-flex',
                    fontSize: `${10 * uiScale}px`,
                    fontWeight: 700,
                    height: `${18 * uiScale}px`,
                    justifyContent: 'center',
                    letterSpacing: '.03em',
                    opacity: isChanged ? 1 : 0,
                    pointerEvents: 'none',
                    textTransform: 'uppercase',
                    visibility: isChanged ? 'visible' : 'hidden',
                    width: `${56 * uiScale}px`,
                }}
            >
                Changed
            </span>
            <div>{children}</div>
        </div>
    );
}

function quickMoveButtonStyle(isActive: boolean, uiScale: number): CSSProperties {
    return {
        background: 'transparent',
        border: 'none',
        color: t.text.muted,
        cursor: isActive ? 'pointer' : 'not-allowed',
        fontSize: `${12 * uiScale}px`,
        opacity: isActive ? 1 : 0.35,
        padding: `${4 * uiScale}px`,
    };
}

function settingsActionButtonStyle(uiScale: number): CSSProperties {
    return {
        background: t.bg.popup,
        border: `1px solid ${t.border.normal}`,
        borderRadius: t.radius.md,
        color: t.text.primary,
        cursor: 'pointer',
        fontSize: `${12 * uiScale}px`,
        padding: `${6 * uiScale}px ${8 * uiScale}px`,
        whiteSpace: 'nowrap',
    };
}

function settingsInputStyle(uiScale: number): CSSProperties {
    return {
        background: t.bg.input,
        border: `1px solid ${t.border.normal}`,
        borderRadius: t.radius.md,
        color: t.text.primary,
        fontSize: `${12 * uiScale}px`,
        padding: `${6 * uiScale}px ${8 * uiScale}px`,
        width: '100%',
    };
}

