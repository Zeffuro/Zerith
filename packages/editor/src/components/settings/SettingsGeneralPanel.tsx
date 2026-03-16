import { type CSSProperties, type ReactNode } from 'react';

import { editorTheme as t } from '../../theme/editorTheme';
import { getVisibleSettingsControls, type SettingsControlId } from './settingsControlRegistry';

type SettingsGeneralPanelProperties = {
    audiosheetShortcutTargetMode: 'cursor' | 'playhead';
    autosaveEnabled: boolean;
    autosaveIntervalMs: number;
    changedControlIds: ReadonlySet<string>;
    focusedControlId: SettingsControlId | undefined;
    isMuted: boolean;
    matchedControlIds: ReadonlySet<string>;
    onSetDetailRowReference: (controlId: SettingsControlId, element: HTMLDivElement | null) => void;
    panelId: string;
    searchQuery: string;
    setAudiosheetShortcutTargetMode: (mode: 'cursor' | 'playhead') => void;
    setAutosaveEnabled: (enabled: boolean) => void;
    setAutosaveIntervalMs: (intervalMs: number) => void;
    showChangedOnly: boolean;
    toggleMute: () => void;
    uiScale: number;
};

export function SettingsGeneralPanel({
    audiosheetShortcutTargetMode,
    autosaveEnabled,
    autosaveIntervalMs,
    changedControlIds,
    focusedControlId,
    isMuted,
    matchedControlIds,
    onSetDetailRowReference,
    panelId,
    searchQuery,
    setAudiosheetShortcutTargetMode,
    setAutosaveEnabled,
    setAutosaveIntervalMs,
    showChangedOnly,
    toggleMute,
    uiScale,
}: SettingsGeneralPanelProperties) {
    const visibleControlIds = new Set(getVisibleSettingsControls(panelId));
    const autosaveIntervalSeconds = Math.max(5, Math.round(autosaveIntervalMs / 1000));
    const autosaveIntervalLabel = `Autosave interval: ${autosaveIntervalSeconds}s`;

    const autosaveChanged = changedControlIds.has('autosaveEnabled');
    const autosaveIntervalChanged = changedControlIds.has('autosaveIntervalMs');
    const audioChanged = changedControlIds.has('audio');
    const audiosheetShortcutTargetModeChanged = changedControlIds.has('audiosheetShortcutTargetMode');

    const showAutosaveRow = visibleControlIds.has('autosaveEnabled') && matchedControlIds.has('autosaveEnabled') && (!showChangedOnly || autosaveChanged);
    const showAutosaveIntervalRow = visibleControlIds.has('autosaveIntervalMs') && matchedControlIds.has('autosaveIntervalMs') && (!showChangedOnly || autosaveIntervalChanged);
    const showAudioRow = visibleControlIds.has('audio') && matchedControlIds.has('audio') && (!showChangedOnly || audioChanged);
    const showAudiosheetShortcutTargetModeRow =
        visibleControlIds.has('audiosheetShortcutTargetMode')
        && matchedControlIds.has('audiosheetShortcutTargetMode')
        && (!showChangedOnly || audiosheetShortcutTargetModeChanged);

    if (!showAutosaveRow && !showAutosaveIntervalRow && !showAudioRow && !showAudiosheetShortcutTargetModeRow) {
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

