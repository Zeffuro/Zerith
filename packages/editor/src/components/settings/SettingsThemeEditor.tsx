import { type CSSProperties, useMemo, useState } from 'react';

import type { CustomThemeEntry } from '../../store/settings/SettingsSchema';
import type { ThemeFile, ThemeVariables } from '../../theme/themeTypes';

import { applyTheme } from '../../theme/applyTheme';
import { editorTheme as t } from '../../theme/editorTheme';
import { getThemeRegistry } from '../../theme/themeRegistry';
import {
    getVariableCategories,
} from '../../theme/themeVariableCatalog';
import { ConfirmDialog } from '../ConfirmDialog';
import { buildPreviewTheme, buildUniqueThemeKey, cloneThemeVariables } from './themeEditorDraftModel';
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
    const [pendingThemeDelete, setPendingThemeDelete] = useState<CustomThemeEntry | undefined>();
    const [draftLabel, setDraftLabel] = useState('');
    const [draftBaseThemeKey, setDraftBaseThemeKey] = useState('classic');
    const [draftVariables, setDraftVariables] = useState<ThemeVariables>({});
    const [previewRestoreTheme, setPreviewRestoreTheme] = useState<ThemeFile | undefined>();

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

    const startCreating = () => {
        setCreateName('');
        setCreateBaseThemeKey(themes.some((theme) => theme.key === activeThemeKey) ? activeThemeKey : 'classic');
        setIsCreating(true);
    };

    const beginEditing = (theme: CustomThemeEntry) => {
        if (activeTheme) {
            setPreviewRestoreTheme({
                key: activeTheme.key,
                label: activeTheme.label,
                vars: { ...activeTheme.vars },
            });
        }

        setEditingThemeKey(theme.key);
        setDraftLabel(theme.label);
        setDraftBaseThemeKey(theme.baseThemeKey ?? 'classic');
        setDraftVariables({ ...theme.vars });

        applyTheme(buildPreviewTheme(theme.baseThemeKey, theme.vars, themes, theme.key, theme.label));
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

        const restoredLabel = editingTheme.label;
        const restoredBaseThemeKey = editingTheme.baseThemeKey ?? 'classic';
        const restoredVariables = { ...editingTheme.vars };

        setDraftLabel(restoredLabel);
        setDraftBaseThemeKey(restoredBaseThemeKey);
        setDraftVariables(restoredVariables);
        applyTheme(buildPreviewTheme(restoredBaseThemeKey, restoredVariables, themes, editingTheme.key, restoredLabel));
    };

    const cancelEditing = () => {
        if (previewRestoreTheme) {
            applyTheme(previewRestoreTheme);
        } else if (activeTheme) {
            applyTheme(activeTheme);
        }

        setEditingThemeKey(undefined);
        setPreviewRestoreTheme(undefined);
    };

    const resetDraftToBase = () => {
        const baseTheme = themes.find((theme) => theme.key === draftBaseThemeKey) ?? themes.find((theme) => theme.key === 'classic') ?? themes[0];
        if (!baseTheme) return;

        const baseVariables = cloneThemeVariables(baseTheme);
        setDraftVariables(baseVariables);
        applyTheme(buildPreviewTheme(draftBaseThemeKey, baseVariables, themes, editingThemeKey, draftLabel));
    };

    const updateDraftBaseThemeKey = (baseThemeKey: string) => {
        setDraftBaseThemeKey(baseThemeKey);
        applyTheme(buildPreviewTheme(baseThemeKey, draftVariables, themes, editingThemeKey, draftLabel));
    };

    const updateVariable = (cssVariable: string, value: string) => {
        document.documentElement.style.setProperty(cssVariable, value);
        setDraftVariables((previous) => ({
            ...previous,
            [cssVariable]: value,
        }));
    };

    const deleteTheme = (key: string) => {
        const theme = customThemes.find((entry) => entry.key === key);
        if (!theme) return;

        setPendingThemeDelete(theme);
    };

    const confirmDeleteTheme = () => {
        const theme = pendingThemeDelete;
        if (!theme) return;

        onDeleteCustomTheme(theme.key);
        if (activeThemeKey === theme.key) {
            onSetActiveThemeKey('classic');
        }
        if (editingThemeKey === theme.key) {
            setEditingThemeKey(undefined);
            setPreviewRestoreTheme(undefined);
        }
        setPendingThemeDelete(undefined);
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
                        <select onChange={(event) => updateDraftBaseThemeKey(event.currentTarget.value)} style={inputStyle(uiScale)} value={draftBaseThemeKey}>
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
                        <button onClick={cancelEditing} style={actionButtonStyle(uiScale)} type="button">
                            Cancel
                        </button>
                        <button onClick={resetDraftToBase} style={actionButtonStyle(uiScale)} type="button">
                            Reset to Base
                        </button>
                    </div>
                </div>
            ) : undefined}

            <ConfirmDialog
                danger
                message={pendingThemeDelete ? `Delete custom theme "${pendingThemeDelete.label}"?` : ''}
                onCancel={() => setPendingThemeDelete(undefined)}
                onConfirm={confirmDeleteTheme}
                open={Boolean(pendingThemeDelete)}
                title="Delete Theme"
            />
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

