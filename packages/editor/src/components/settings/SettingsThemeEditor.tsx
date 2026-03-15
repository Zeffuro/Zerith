import { type CSSProperties, useEffect, useMemo, useState } from 'react';

import type { CustomThemeEntry } from '../../store/settings/SettingsSchema';
import type { ThemeFile, ThemeVariables } from '../../theme/themeTypes';

import { applyTheme } from '../../theme/applyTheme';
import { editorTheme as t } from '../../theme/editorTheme';
import { getThemeRegistry } from '../../theme/themeRegistry';
import {
    getVariableCategories,
    themeVariableCatalog,
} from '../../theme/themeVariableCatalog';
import { ThemeVariableGrid } from './ThemeVariableGrid';

type SettingsThemeEditorProperties = {
    activeThemeKey: string;
    customThemes: CustomThemeEntry[];
    onAddCustomTheme: (theme: CustomThemeEntry) => void;
    onDeleteCustomTheme: (key: string) => void;
    onSetActiveThemeKey: (key: string) => void;
    onUpdateCustomTheme: (key: string, updates: Partial<Omit<CustomThemeEntry, 'key'>>) => void;
    uiScale: number;
};

export function SettingsThemeEditor({
    activeThemeKey,
    customThemes,
    onAddCustomTheme,
    onDeleteCustomTheme,
    onSetActiveThemeKey,
    onUpdateCustomTheme,
    uiScale,
}: SettingsThemeEditorProperties) {
    const [isCreating, setIsCreating] = useState(false);
    const [createBaseThemeKey, setCreateBaseThemeKey] = useState('classic');
    const [createName, setCreateName] = useState('');
    const [editingThemeKey, setEditingThemeKey] = useState<string | undefined>();
    const [draftLabel, setDraftLabel] = useState('');
    const [draftBaseThemeKey, setDraftBaseThemeKey] = useState('classic');
    const [draftVariables, setDraftVariables] = useState<ThemeVariables>({});

    const themes = useMemo(() => getThemeRegistry(customThemes), [customThemes]);
    const categoryNames = useMemo(() => getVariableCategories(), []);
    const activeTheme = useMemo(
        () => themes.find((theme) => theme.key === activeThemeKey) ?? themes.find((theme) => theme.key === 'classic') ?? themes[0],
        [activeThemeKey, themes],
    );
    const editingTheme = useMemo(
        () => customThemes.find((theme) => theme.key === editingThemeKey),
        [customThemes, editingThemeKey],
    );

    useEffect(() => {
        if (!editingThemeKey) return;

        applyTheme({ key: editingThemeKey, label: draftLabel || 'Preview', vars: draftVariables });

        return () => {
            if (activeTheme) applyTheme(activeTheme);
        };
    }, [activeTheme, draftLabel, draftVariables, editingThemeKey]);

    const startCreating = () => {
        setCreateName('');
        setCreateBaseThemeKey(themes.some((theme) => theme.key === activeThemeKey) ? activeThemeKey : 'classic');
        setIsCreating(true);
    };

    const beginEditing = (theme: CustomThemeEntry) => {
        setEditingThemeKey(theme.key);
        setDraftLabel(theme.label);
        setDraftBaseThemeKey(theme.baseThemeKey ?? 'classic');
        setDraftVariables({ ...theme.vars });
    };

    const submitCreate = () => {
        const label = createName.trim();
        if (label.length === 0) return;

        const baseTheme = themes.find((theme) => theme.key === createBaseThemeKey) ?? themes.find((theme) => theme.key === 'classic') ?? themes[0];
        if (!baseTheme) return;

        const key = buildUniqueThemeKey(label, customThemes.map((theme) => theme.key));
        const variables = cloneThemeVariables(baseTheme);
        const createdTheme: CustomThemeEntry = {
            baseThemeKey: baseTheme.key,
            key,
            label,
            vars: variables,
        };

        onAddCustomTheme(createdTheme);
        onSetActiveThemeKey(createdTheme.key);
        setIsCreating(false);
        beginEditing(createdTheme);
    };

    const saveDraft = () => {
        if (!editingThemeKey) return;

        const label = draftLabel.trim();
        if (label.length === 0) return;

        onUpdateCustomTheme(editingThemeKey, {
            baseThemeKey: draftBaseThemeKey,
            label,
            vars: { ...draftVariables },
        });
    };

    const revertDraft = () => {
        if (!editingTheme) return;

        setDraftLabel(editingTheme.label);
        setDraftBaseThemeKey(editingTheme.baseThemeKey ?? 'classic');
        setDraftVariables({ ...editingTheme.vars });
    };

    const resetDraftToBase = () => {
        const baseTheme = themes.find((theme) => theme.key === draftBaseThemeKey) ?? themes.find((theme) => theme.key === 'classic') ?? themes[0];
        if (!baseTheme) return;

        setDraftVariables(cloneThemeVariables(baseTheme));
    };

    const updateVariable = (cssVariable: string, value: string) => {
        setDraftVariables((previous) => ({
            ...previous,
            [cssVariable]: value,
        }));
    };

    const deleteTheme = (key: string) => {
        const theme = customThemes.find((entry) => entry.key === key);
        if (!theme) return;

        const confirmed = globalThis.confirm(`Delete custom theme "${theme.label}"?`);
        if (!confirmed) return;

        onDeleteCustomTheme(key);
        if (activeThemeKey === key) {
            onSetActiveThemeKey('classic');
        }
        if (editingThemeKey === key) {
            setEditingThemeKey(undefined);
        }
    };

    return (
        <div style={{ display: 'grid', gap: `${10 * uiScale}px` }}>
            <div style={{ color: t.text.normal, fontSize: `${12 * uiScale}px`, fontWeight: 600 }}>Custom Themes</div>

            {customThemes.length === 0 ? (
                <div style={{ color: t.text.muted, fontSize: `${12 * uiScale}px` }}>No custom themes yet.</div>
            ) : (
                <div style={{ display: 'grid', gap: `${6 * uiScale}px` }}>
                    {customThemes.toSorted((a, b) => a.label.localeCompare(b.label)).map((theme) => (
                        <div
                            key={theme.key}
                            style={{
                                alignItems: 'center',
                                background: theme.key === editingThemeKey ? t.bg.selected : t.bg.panelAlt,
                                border: `1px solid ${theme.key === editingThemeKey ? t.border.accent : t.border.subtle}`,
                                borderRadius: t.radius.md,
                                display: 'grid',
                                gap: `${8 * uiScale}px`,
                                gridTemplateColumns: '1fr auto auto',
                                padding: `${6 * uiScale}px ${8 * uiScale}px`,
                            }}
                        >
                            <div style={{ color: t.text.primary, fontSize: `${12 * uiScale}px` }}>
                                {theme.label}
                                <span style={{ color: t.text.muted, marginLeft: `${6 * uiScale}px` }}>({theme.key})</span>
                            </div>
                            <button onClick={() => beginEditing(theme)} style={actionButtonStyle(uiScale)} type="button">
                                Edit
                            </button>
                            <button onClick={() => deleteTheme(theme.key)} style={dangerButtonStyle(uiScale)} type="button">
                                Delete
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {isCreating ? (
                <div style={panelStyle(uiScale)}>
                    <div style={{ color: t.text.primary, fontSize: `${12 * uiScale}px`, fontWeight: 600 }}>Create New Theme</div>
                    <label style={fieldLabelStyle(uiScale)}>
                        Base Theme
                        <select onChange={(event) => setCreateBaseThemeKey(event.currentTarget.value)} style={inputStyle(uiScale)} value={createBaseThemeKey}>
                            {themes.map((theme) => (
                                <option key={theme.key} value={theme.key}>
                                    {theme.label}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label style={fieldLabelStyle(uiScale)}>
                        Name
                        <input
                            onChange={(event) => setCreateName(event.currentTarget.value)}
                            placeholder="Courtroom Night"
                            style={inputStyle(uiScale)}
                            type="text"
                            value={createName}
                        />
                    </label>
                    <div style={{ display: 'flex', gap: `${8 * uiScale}px` }}>
                        <button onClick={submitCreate} style={primaryButtonStyle(uiScale)} type="button">
                            Create
                        </button>
                        <button onClick={() => setIsCreating(false)} style={actionButtonStyle(uiScale)} type="button">
                            Cancel
                        </button>
                    </div>
                </div>
            ) : (
                <button onClick={startCreating} style={actionButtonStyle(uiScale)} type="button">
                    Create New Theme
                </button>
            )}

            {editingThemeKey ? (
                <div style={panelStyle(uiScale)}>
                    <div style={{ color: t.text.primary, fontSize: `${12 * uiScale}px`, fontWeight: 600 }}>Theme Editor</div>
                    <label style={fieldLabelStyle(uiScale)}>
                        Name
                        <input onChange={(event) => setDraftLabel(event.currentTarget.value)} style={inputStyle(uiScale)} type="text" value={draftLabel} />
                    </label>
                    <label style={fieldLabelStyle(uiScale)}>
                        Base Theme
                        <select onChange={(event) => setDraftBaseThemeKey(event.currentTarget.value)} style={inputStyle(uiScale)} value={draftBaseThemeKey}>
                            {themes.map((theme) => (
                                <option key={theme.key} value={theme.key}>
                                    {theme.label}
                                </option>
                            ))}
                        </select>
                    </label>

                    <ThemeVariableGrid categoryNames={categoryNames} onChange={updateVariable} uiScale={uiScale} vars={draftVariables} />

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: `${8 * uiScale}px` }}>
                        <button onClick={saveDraft} style={primaryButtonStyle(uiScale)} type="button">
                            Save
                        </button>
                        <button onClick={revertDraft} style={actionButtonStyle(uiScale)} type="button">
                            Revert
                        </button>
                        <button onClick={resetDraftToBase} style={actionButtonStyle(uiScale)} type="button">
                            Reset to Base
                        </button>
                    </div>
                </div>
            ) : undefined}
        </div>
    );
}

function actionButtonStyle(uiScale: number): CSSProperties {
    return {
        background: t.bg.popup,
        border: `1px solid ${t.border.normal}`,
        borderRadius: t.radius.md,
        color: t.text.primary,
        cursor: 'pointer',
        fontSize: `${12 * uiScale}px`,
        padding: `${6 * uiScale}px ${10 * uiScale}px`,
    };
}

function buildUniqueThemeKey(label: string, existingKeys: string[]): string {
    const slug = label
        .toLowerCase()
        .replaceAll(/[^a-z0-9]+/g, '-')
        .replaceAll(/^-+|-+$/g, '') || 'theme';

    const baseKey = `custom-${slug}`;
    const existing = new Set(existingKeys);

    if (!existing.has(baseKey)) return baseKey;

    let index = 2;
    while (existing.has(`${baseKey}-${index}`)) {
        index += 1;
    }

    return `${baseKey}-${index}`;
}

function cloneThemeVariables(theme: ThemeFile): ThemeVariables {
    const variables = { ...theme.vars };

    for (const variable of themeVariableCatalog) {
        if (variables[variable.cssVar]) continue;
        if (!variable.defaultValue) continue;
        variables[variable.cssVar] = variable.defaultValue;
    }

    return variables;
}

function dangerButtonStyle(uiScale: number): CSSProperties {
    return {
        ...actionButtonStyle(uiScale),
        background: t.bg.danger,
        borderColor: t.accent.red,
        color: '#fff',
    };
}


function fieldLabelStyle(uiScale: number): CSSProperties {
    return {
        color: t.text.normal,
        display: 'grid',
        fontSize: `${12 * uiScale}px`,
        gap: `${4 * uiScale}px`,
    };
}

function inputStyle(uiScale: number): CSSProperties {
    return {
        background: t.bg.input,
        border: `1px solid ${t.border.normal}`,
        borderRadius: t.radius.md,
        color: t.text.primary,
        fontSize: `${12 * uiScale}px`,
        minWidth: 0,
        padding: `${6 * uiScale}px ${8 * uiScale}px`,
    };
}

function panelStyle(uiScale: number): CSSProperties {
    return {
        background: t.bg.panelAlt,
        border: `1px solid ${t.border.subtle}`,
        borderRadius: t.radius.md,
        display: 'grid',
        gap: `${8 * uiScale}px`,
        padding: `${10 * uiScale}px`,
    };
}

function primaryButtonStyle(uiScale: number): CSSProperties {
    return {
        ...actionButtonStyle(uiScale),
        background: t.accent.primary,
        borderColor: t.border.accent,
        color: '#fff',
    };
}

