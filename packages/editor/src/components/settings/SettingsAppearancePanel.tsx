import { type CSSProperties, type ReactNode } from 'react';

import { editorTheme as t } from '../../theme/editorTheme';
import { getVisibleSettingsControls, type SettingsControlId } from './settingsControlRegistry';

type SettingsAppearancePanelProperties = {
    changedControlIds: ReadonlySet<string>;
    focusedControlId: SettingsControlId | undefined;
    matchedControlIds: ReadonlySet<string>;
    onSetDetailRowReference: (controlId: SettingsControlId, element: HTMLDivElement | null) => void;
    panelId: string;
    searchQuery: string;
    setThemeKey: (key: string) => void;
    setUiScale: (scale: number) => void;
    showChangedOnly: boolean;
    themeKey: string;
    uiScale: number;
};

export function SettingsAppearancePanel({
    changedControlIds,
    focusedControlId,
    matchedControlIds,
    onSetDetailRowReference,
    panelId,
    searchQuery,
    setThemeKey,
    setUiScale,
    showChangedOnly,
    themeKey,
    uiScale,
}: SettingsAppearancePanelProperties) {
    const visibleControlIds = new Set(getVisibleSettingsControls(panelId));

    const themeChanged = changedControlIds.has('theme');
    const scaleChanged = changedControlIds.has('uiScale');

    const showThemeRow = visibleControlIds.has('theme') && matchedControlIds.has('theme') && (!showChangedOnly || themeChanged);
    const showScaleRow = visibleControlIds.has('uiScale') && matchedControlIds.has('uiScale') && (!showChangedOnly || scaleChanged);

    if (!showThemeRow && !showScaleRow) {
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
            {showThemeRow ? (
                <EditableSettingRow
                    controlId="theme"
                    isChanged={themeChanged}
                    isFocused={focusedControlId === 'theme'}
                    label="Theme"
                    onSetDetailRowReference={onSetDetailRowReference}
                    uiScale={uiScale}
                >
                    <select
                        onChange={(event) => setThemeKey(event.currentTarget.value)}
                        style={settingsInputStyle(uiScale)}
                        value={themeKey}
                    >
                        <option value="classic">Classic</option>
                        <option value="classicSoft">Classic Soft</option>
                    </select>
                </EditableSettingRow>
            ) : undefined}

            {showScaleRow ? (
                <EditableSettingRow
                    controlId="uiScale"
                    isChanged={scaleChanged}
                    isFocused={focusedControlId === 'uiScale'}
                    label="UI Scale"
                    onSetDetailRowReference={onSetDetailRowReference}
                    uiScale={uiScale}
                >
                    <div style={{ alignItems: 'center', display: 'grid', gap: `${8 * uiScale}px`, gridTemplateColumns: '1fr auto' }}>
                        <input
                            max={1.5}
                            min={0.8}
                            onChange={(event) => setUiScale(Number(event.currentTarget.value))}
                            step={0.05}
                            style={{ width: '100%' }}
                            type="range"
                            value={uiScale}
                        />
                        <span style={{ color: t.text.primary, fontSize: `${12 * uiScale}px`, minWidth: `${48 * uiScale}px`, textAlign: 'right' }}>
                            {Math.round(uiScale * 100)}%
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

