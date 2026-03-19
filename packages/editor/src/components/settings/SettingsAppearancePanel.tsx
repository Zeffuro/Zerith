import { type CSSProperties, type ReactNode, useMemo } from 'react';

import type { CustomThemeEntry } from '../../store/settings/SettingsSchema';
import type { ThemeVariables } from '../../theme/themeTypes';

import { editorTheme as t } from '../../theme/editorTheme';
import { getThemeRegistry } from '../../theme/themeRegistry';
import { themeVariableLabels } from '../../theme/themeVariableLabels';
import { getVisibleSettingsControls, type SettingsControlId } from './settingsControlRegistry';
import { SettingsThemeEditor } from './SettingsThemeEditor';

type SettingsAppearancePanelProperties = {
    changedControlIds: ReadonlySet<string>;
    customThemes: CustomThemeEntry[];
    editorScale: number | undefined;
    explorerScale: number | undefined;
    focusedControlId: SettingsControlId | undefined;
    inspectorScale: number | undefined;
    matchedControlIds: ReadonlySet<string>;
    onAddCustomTheme: (theme: CustomThemeEntry) => void;
    onDeleteCustomTheme: (key: string) => void;
    onSetDetailRowReference: (controlId: SettingsControlId, element: HTMLDivElement | null) => void;
    onUpdateCustomTheme: (key: string, updates: Partial<Omit<CustomThemeEntry, 'key'>>) => void;
    panelId: string;
    searchQuery: string;
    setEditorScale: (scale: number | undefined) => void;
    setExplorerScale: (scale: number | undefined) => void;
    setInspectorScale: (scale: number | undefined) => void;
    setThemeKey: (key: string) => void;
    setTimelineScale: (scale: number | undefined) => void;
    setUiScale: (scale: number) => void;
    showChangedOnly: boolean;
    themeKey: string;
    timelineScale: number | undefined;
    uiScale: number;
};

type ThemeSwatch = {
    label: string;
    value: string;
    variable: string;
};

const previewVariableOrder = [
    '--editor-bg-app',
    '--editor-bg-panel',
    '--editor-bg-panel-alt',
    '--editor-border-normal',
    '--editor-text-primary',
    '--editor-text-normal',
    '--editor-accent-primary',
    '--editor-accent-green',
] as const;

export function SettingsAppearancePanel({
    changedControlIds,
    customThemes,
    editorScale,
    explorerScale,
    focusedControlId,
    inspectorScale,
    matchedControlIds,
    onAddCustomTheme,
    onDeleteCustomTheme,
    onSetDetailRowReference,
    onUpdateCustomTheme,
    panelId,
    searchQuery,
    setEditorScale,
    setExplorerScale,
    setInspectorScale,
    setThemeKey,
    setTimelineScale,
    setUiScale,
    showChangedOnly,
    themeKey,
    timelineScale,
    uiScale,
}: SettingsAppearancePanelProperties) {
    const themes = useMemo(() => getThemeRegistry(customThemes), [customThemes]);
    const visibleControlIds = new Set(getVisibleSettingsControls(panelId));

    const themeChanged = changedControlIds.has('theme');
    const customThemesChanged = changedControlIds.has('customThemes');
    const scaleChanged = changedControlIds.has('uiScale');
    const timelineScaleChanged = changedControlIds.has('timelineScale');
    const inspectorScaleChanged = changedControlIds.has('inspectorScale');
    const explorerScaleChanged = changedControlIds.has('explorerScale');
    const editorScaleChanged = changedControlIds.has('editorScale');

    const showThemeRow = visibleControlIds.has('theme') && matchedControlIds.has('theme') && (!showChangedOnly || themeChanged);
    const showCustomThemesRow = visibleControlIds.has('customThemes')
        && matchedControlIds.has('customThemes')
        && (!showChangedOnly || customThemesChanged);
    const showScaleRow = visibleControlIds.has('uiScale') && matchedControlIds.has('uiScale') && (!showChangedOnly || scaleChanged);
    const showTimelineScaleRow = visibleControlIds.has('timelineScale')
        && matchedControlIds.has('timelineScale')
        && (!showChangedOnly || timelineScaleChanged);
    const showInspectorScaleRow = visibleControlIds.has('inspectorScale')
        && matchedControlIds.has('inspectorScale')
        && (!showChangedOnly || inspectorScaleChanged);
    const showExplorerScaleRow = visibleControlIds.has('explorerScale')
        && matchedControlIds.has('explorerScale')
        && (!showChangedOnly || explorerScaleChanged);
    const showEditorScaleRow = visibleControlIds.has('editorScale')
        && matchedControlIds.has('editorScale')
        && (!showChangedOnly || editorScaleChanged);

    if (!showThemeRow && !showCustomThemesRow && !showScaleRow && !showTimelineScaleRow && !showInspectorScaleRow && !showExplorerScaleRow && !showEditorScaleRow) {
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
                    <div style={{ display: 'grid', gap: `${8 * uiScale}px` }}>
                        <select
                            onChange={(event) => setThemeKey(event.currentTarget.value)}
                            style={settingsInputStyle(uiScale)}
                            value={themeKey}
                        >
                            {themes.map((theme) => (
                                <option key={theme.key} value={theme.key}>
                                    {theme.label}
                                </option>
                            ))}
                        </select>

                        <div
                            style={{
                                display: 'grid',
                                gap: `${8 * uiScale}px`,
                                gridTemplateColumns: `repeat(auto-fit, minmax(${180 * uiScale}px, 1fr))`,
                            }}
                        >
                            {themes.map((theme) => {
                                const isSelected = themeKey === theme.key;
                                const swatches = getThemeSwatches(theme.vars);

                                return (
                                    <button
                                        key={theme.key}
                                        onClick={() => setThemeKey(theme.key)}
                                        style={{
                                            alignItems: 'stretch',
                                            background: t.bg.panelAlt,
                                            border: `1px solid ${isSelected ? t.border.accent : t.border.normal}`,
                                            borderRadius: t.radius.md,
                                            color: t.text.primary,
                                            cursor: 'pointer',
                                            display: 'grid',
                                            gap: `${8 * uiScale}px`,
                                            padding: `${8 * uiScale}px`,
                                            textAlign: 'left',
                                        }}
                                        type="button"
                                    >
                                        <div
                                            style={{
                                                alignItems: 'center',
                                                display: 'flex',
                                                fontSize: `${12 * uiScale}px`,
                                                fontWeight: 600,
                                                justifyContent: 'space-between',
                                            }}
                                        >
                                            <span>{theme.label}</span>
                                            <span
                                                style={{
                                                    background: isSelected ? t.accent.primary : 'transparent',
                                                    border: `1px solid ${isSelected ? t.border.accent : t.border.subtle}`,
                                                    borderRadius: t.radius.sm,
                                                    color: isSelected ? '#fff' : t.text.muted,
                                                    fontSize: `${10 * uiScale}px`,
                                                    padding: `${2 * uiScale}px ${6 * uiScale}px`,
                                                    textTransform: 'uppercase',
                                                }}
                                            >
                                                {isSelected ? 'Current' : 'Select'}
                                            </span>
                                        </div>

                                        <div style={{ display: 'grid', gap: `${4 * uiScale}px`, gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
                                            {swatches.map((swatch) => (
                                                <span
                                                    key={swatch.variable}
                                                    style={{
                                                        background: swatch.value,
                                                        border: `1px solid ${t.border.subtle}`,
                                                        borderRadius: t.radius.sm,
                                                        display: 'block',
                                                        height: `${16 * uiScale}px`,
                                                    }}
                                                    title={`${swatch.label}: ${swatch.value}`}
                                                />
                                            ))}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </EditableSettingRow>
            ) : undefined}

            {showCustomThemesRow ? (
                <EditableSettingRow
                    controlId="customThemes"
                    isChanged={customThemesChanged}
                    isFocused={focusedControlId === 'customThemes'}
                    label="Custom Themes"
                    onSetDetailRowReference={onSetDetailRowReference}
                    stacked
                    uiScale={uiScale}
                >
                    <SettingsThemeEditor
                        activeThemeKey={themeKey}
                        customThemes={customThemes}
                        onAddCustomTheme={onAddCustomTheme}
                        onDeleteCustomTheme={onDeleteCustomTheme}
                        onSetActiveThemeKey={setThemeKey}
                        onUpdateCustomTheme={onUpdateCustomTheme}
                        uiScale={uiScale}
                    />
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

            {showTimelineScaleRow ? (
                <PerComponentScaleRow
                    controlId="timelineScale"
                    focusedControlId={focusedControlId}
                    isChanged={timelineScaleChanged}
                    label="Timeline Scale"
                    onSetDetailRowReference={onSetDetailRowReference}
                    scale={timelineScale}
                    setScale={setTimelineScale}
                    uiScale={uiScale}
                />
            ) : undefined}

            {showInspectorScaleRow ? (
                <PerComponentScaleRow
                    controlId="inspectorScale"
                    focusedControlId={focusedControlId}
                    isChanged={inspectorScaleChanged}
                    label="Inspector Scale"
                    onSetDetailRowReference={onSetDetailRowReference}
                    scale={inspectorScale}
                    setScale={setInspectorScale}
                    uiScale={uiScale}
                />
            ) : undefined}

            {showExplorerScaleRow ? (
                <PerComponentScaleRow
                    controlId="explorerScale"
                    focusedControlId={focusedControlId}
                    isChanged={explorerScaleChanged}
                    label="Explorer Scale"
                    onSetDetailRowReference={onSetDetailRowReference}
                    scale={explorerScale}
                    setScale={setExplorerScale}
                    uiScale={uiScale}
                />
            ) : undefined}

            {showEditorScaleRow ? (
                <PerComponentScaleRow
                    controlId="editorScale"
                    focusedControlId={focusedControlId}
                    isChanged={editorScaleChanged}
                    label="Editor Surface Scale"
                    onSetDetailRowReference={onSetDetailRowReference}
                    scale={editorScale}
                    setScale={setEditorScale}
                    uiScale={uiScale}
                />
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

function EditableSettingRow({
    children,
    controlId,
    isChanged = false,
    isFocused = false,
    label,
    onSetDetailRowReference,
    stacked = false,
    uiScale,
}: {
    children: ReactNode;
    controlId: SettingsControlId;
    isChanged?: boolean;
    isFocused?: boolean;
    label: string;
    onSetDetailRowReference: (controlId: SettingsControlId, element: HTMLDivElement | null) => void;
    stacked?: boolean;
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
                gridTemplateColumns: stacked ? '1fr' : `${170 * uiScale}px auto 1fr`,
                padding: `${10 * uiScale}px ${12 * uiScale}px`,
            }}
        >
            {stacked ? (
                <>
                    <div style={{ alignItems: 'center', display: 'flex', gap: `${8 * uiScale}px`, justifyContent: 'space-between' }}>
                        <span style={{ color: t.text.normal, fontSize: `${12 * uiScale}px` }}>{label}</span>
                        <span style={changedBadgeStyle(isChanged, uiScale)}>Changed</span>
                    </div>
                    <div style={{ minWidth: 0 }}>{children}</div>
                </>
            ) : (
                <>
                    <span style={{ color: t.text.normal, fontSize: `${12 * uiScale}px` }}>{label}</span>
                    <span style={changedBadgeStyle(isChanged, uiScale)}>Changed</span>
                    <div style={{ minWidth: 0 }}>{children}</div>
                </>
            )}
        </div>
    );
}

function getThemeSwatches(variables: ThemeVariables): ThemeSwatch[] {
    return previewVariableOrder.flatMap((variable) => {
        const value = variables[variable];
        return value
            ? [{
                label: themeVariableLabels[variable] ?? variable,
                value,
                variable,
            }]
            : [];
    });
}

function PerComponentScaleRow({
    controlId,
    focusedControlId,
    isChanged,
    label,
    onSetDetailRowReference,
    scale,
    setScale,
    uiScale,
}: {
    controlId: 'editorScale' | 'explorerScale' | 'inspectorScale' | 'timelineScale';
    focusedControlId: SettingsControlId | undefined;
    isChanged: boolean;
    label: string;
    onSetDetailRowReference: (controlId: SettingsControlId, element: HTMLDivElement | null) => void;
    scale: number | undefined;
    setScale: (scale: number | undefined) => void;
    uiScale: number;
}) {
    const effectiveScale = scale ?? uiScale;

    return (
        <EditableSettingRow
            controlId={controlId}
            isChanged={isChanged}
            isFocused={focusedControlId === controlId}
            label={label}
            onSetDetailRowReference={onSetDetailRowReference}
            uiScale={uiScale}
        >
            <div style={{ display: 'grid', gap: `${8 * uiScale}px` }}>
                <select
                    onChange={(event) => {
                        const value = event.currentTarget.value;
                        setScale(value === 'global' ? undefined : Number(value));
                    }}
                    style={settingsInputStyle(uiScale)}
                    value={scale === undefined ? 'global' : String(scale)}
                >
                    <option value="global">Follow global ({Math.round(uiScale * 100)}%)</option>
                    {[0.8, 0.9, 1, 1.1, 1.2, 1.3, 1.4, 1.5].map((value) => (
                        <option key={value} value={String(value)}>{Math.round(value * 100)}%</option>
                    ))}
                </select>
                <span style={{ color: t.text.muted, fontSize: `${11 * uiScale}px` }}>
                    Effective scale: {Math.round(effectiveScale * 100)}%
                </span>
            </div>
        </EditableSettingRow>
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
