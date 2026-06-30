import { type CSSProperties, type ReactNode } from 'react';

import type { CodeEditorScreenReaderMode } from '../../store/settings/SettingsSchema';

import { editorTheme as t } from '../../theme/editorTheme';
import { getVisibleSettingsControls, type SettingsControlId } from './settingsControlRegistry';

type SettingsEditorPanelProperties = {
    changedControlIds: ReadonlySet<string>;
    codeEditorLargeText: boolean;
    codeEditorPlainTextComfort: boolean;
    codeEditorScreenReaderMode: CodeEditorScreenReaderMode;
    focusedControlId: SettingsControlId | undefined;
    matchedControlIds: ReadonlySet<string>;
    onSetDetailRowReference: (controlId: SettingsControlId, element: HTMLDivElement | null) => void;
    panelId: string;
    searchQuery: string;
    setCodeEditorLargeText: (enabled: boolean) => void;
    setCodeEditorPlainTextComfort: (enabled: boolean) => void;
    setCodeEditorScreenReaderMode: (mode: CodeEditorScreenReaderMode) => void;
    showChangedOnly: boolean;
    uiScale: number;
};

export function SettingsEditorPanel({
    changedControlIds,
    codeEditorLargeText,
    codeEditorPlainTextComfort,
    codeEditorScreenReaderMode,
    focusedControlId,
    matchedControlIds,
    onSetDetailRowReference,
    panelId,
    searchQuery,
    setCodeEditorLargeText,
    setCodeEditorPlainTextComfort,
    setCodeEditorScreenReaderMode,
    showChangedOnly,
    uiScale,
}: SettingsEditorPanelProperties) {
    const visibleControlIds = new Set(getVisibleSettingsControls(panelId));
    const screenReaderModeChanged = changedControlIds.has('codeEditorScreenReaderMode');
    const plainTextComfortChanged = changedControlIds.has('codeEditorPlainTextComfort');
    const largeTextChanged = changedControlIds.has('codeEditorLargeText');

    const showScreenReaderModeRow = visibleControlIds.has('codeEditorScreenReaderMode')
        && matchedControlIds.has('codeEditorScreenReaderMode')
        && (!showChangedOnly || screenReaderModeChanged);
    const showPlainTextComfortRow = visibleControlIds.has('codeEditorPlainTextComfort')
        && matchedControlIds.has('codeEditorPlainTextComfort')
        && (!showChangedOnly || plainTextComfortChanged);
    const showLargeTextRow = visibleControlIds.has('codeEditorLargeText')
        && matchedControlIds.has('codeEditorLargeText')
        && (!showChangedOnly || largeTextChanged);

    if (!showScreenReaderModeRow && !showPlainTextComfortRow && !showLargeTextRow) {
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
            {showScreenReaderModeRow ? (
                <EditableSettingRow
                    controlId="codeEditorScreenReaderMode"
                    isChanged={screenReaderModeChanged}
                    isFocused={focusedControlId === 'codeEditorScreenReaderMode'}
                    label="Screen Reader Mode"
                    onSetDetailRowReference={onSetDetailRowReference}
                    uiScale={uiScale}
                >
                    <select
                        onChange={(event) => setCodeEditorScreenReaderMode(event.currentTarget.value as CodeEditorScreenReaderMode)}
                        style={settingsInputStyle(uiScale)}
                        value={codeEditorScreenReaderMode}
                    >
                        <option value="auto">Auto</option>
                        <option value="on">On</option>
                        <option value="off">Off</option>
                    </select>
                </EditableSettingRow>
            ) : undefined}

            {showPlainTextComfortRow ? (
                <EditableSettingRow
                    controlId="codeEditorPlainTextComfort"
                    isChanged={plainTextComfortChanged}
                    isFocused={focusedControlId === 'codeEditorPlainTextComfort'}
                    label="Plain-Text Comfort"
                    onSetDetailRowReference={onSetDetailRowReference}
                    uiScale={uiScale}
                >
                    <label style={checkboxLabelStyle(uiScale)}>
                        <input
                            checked={codeEditorPlainTextComfort}
                            onChange={(event) => setCodeEditorPlainTextComfort(event.currentTarget.checked)}
                            type="checkbox"
                        />
                        Wrap lines and simplify code-editor chrome
                    </label>
                </EditableSettingRow>
            ) : undefined}

            {showLargeTextRow ? (
                <EditableSettingRow
                    controlId="codeEditorLargeText"
                    isChanged={largeTextChanged}
                    isFocused={focusedControlId === 'codeEditorLargeText'}
                    label="Large Editor Text"
                    onSetDetailRowReference={onSetDetailRowReference}
                    uiScale={uiScale}
                >
                    <label style={checkboxLabelStyle(uiScale)}>
                        <input
                            checked={codeEditorLargeText}
                            onChange={(event) => setCodeEditorLargeText(event.currentTarget.checked)}
                            type="checkbox"
                        />
                        Increase Monaco font and line height
                    </label>
                </EditableSettingRow>
            ) : undefined}
        </>
    );
}

function changedBadgeStyle(isChanged: boolean, uiScale: number): CSSProperties {
    return {
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
    };
}

function checkboxLabelStyle(uiScale: number): CSSProperties {
    return {
        alignItems: 'center',
        color: t.text.primary,
        display: 'inline-flex',
        fontSize: `${12 * uiScale}px`,
        gap: `${6 * uiScale}px`,
    };
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
            <span style={changedBadgeStyle(isChanged, uiScale)}>Changed</span>
            <div style={{ minWidth: 0 }}>{children}</div>
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
