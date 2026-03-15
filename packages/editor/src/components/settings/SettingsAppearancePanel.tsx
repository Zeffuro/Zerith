import { type CSSProperties, type ReactNode, useMemo } from 'react';

import type { CustomThemeEntry } from '../../store/settings/SettingsSchema';
import type { ThemeVariables } from '../../theme/themeTypes';

import { editorTheme as t } from '../../theme/editorTheme';
import { getThemeRegistry } from '../../theme/themeRegistry';
import { getVisibleSettingsControls, type SettingsControlId } from './settingsControlRegistry';
import { SettingsThemeEditor } from './SettingsThemeEditor';

type SettingsAppearancePanelProperties = {
    changedControlIds: ReadonlySet<string>;
    customThemes: CustomThemeEntry[];
    focusedControlId: SettingsControlId | undefined;
    matchedControlIds: ReadonlySet<string>;
    onAddCustomTheme: (theme: CustomThemeEntry) => void;
    onDeleteCustomTheme: (key: string) => void;
    onSetDetailRowReference: (controlId: SettingsControlId, element: HTMLDivElement | null) => void;
    onUpdateCustomTheme: (key: string, updates: Partial<Omit<CustomThemeEntry, 'key'>>) => void;
    panelId: string;
    searchQuery: string;
    setThemeKey: (key: string) => void;
    setUiScale: (scale: number) => void;
    showChangedOnly: boolean;
    themeKey: string;
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
    focusedControlId,
    matchedControlIds,
    onAddCustomTheme,
    onDeleteCustomTheme,
    onSetDetailRowReference,
    onUpdateCustomTheme,
    panelId,
    searchQuery,
    setThemeKey,
    setUiScale,
    showChangedOnly,
    themeKey,
    uiScale,
}: SettingsAppearancePanelProperties) {
    const themes = useMemo(() => getThemeRegistry(customThemes), [customThemes]);
    const visibleControlIds = new Set(getVisibleSettingsControls(panelId));

    const themeChanged = changedControlIds.has('theme');
    const customThemesChanged = changedControlIds.has('customThemes');
    const scaleChanged = changedControlIds.has('uiScale');

    const showThemeRow = visibleControlIds.has('theme') && matchedControlIds.has('theme') && (!showChangedOnly || themeChanged);
    const showCustomThemesRow = visibleControlIds.has('customThemes')
        && matchedControlIds.has('customThemes')
        && (!showChangedOnly || customThemesChanged);
    const showScaleRow = visibleControlIds.has('uiScale') && matchedControlIds.has('uiScale') && (!showChangedOnly || scaleChanged);

    if (!showThemeRow && !showCustomThemesRow && !showScaleRow) {
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

function getThemeSwatches(variables: ThemeVariables): ThemeSwatch[] {
    return previewVariableOrder.flatMap((variable) => {
        const value = variables[variable];
        return value
            ? [{
                label: variable.replace('--editor-', ''),
                value,
                variable,
            }]
            : [];
    });
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


