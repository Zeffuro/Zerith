import { useCallback, useMemo } from 'react';

import { executeInspectorFieldPatchAction } from '../store/actions/inspectorFieldActions';
import { useProjectStore } from '../store/storeBootstrap';
import { useScriptStore } from '../store/storeBootstrap';
import { useEditorStore } from '../store/useEditorStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { editorTheme as t } from '../theme/editorTheme';

export function useInspectorFieldEditor(index?: null | number) {
    const uiScale = useSettingsStore((state) => state.uiScale);
    const validationErrors = useEditorStore((state) => state.validationErrors);
    const editingAllMacrosFile = useProjectStore((s) => s.editingAllMacrosFile);

    const selectedNodePath = useScriptStore((state) => state.selectedNodePath);

    const applyNodePatch = useCallback((patch: Record<string, unknown>) => {
        executeInspectorFieldPatchAction({ index, patch });
    }, [index]);

    const handleChange = useCallback((field: string, value: unknown) => {
        applyNodePatch({ [field]: value });
    }, [applyNodePatch]);

    const labelStyle = useMemo(
        () => ({
            color: t.text.muted,
            display: 'block',
            fontSize: '0.85em',
            marginBottom: `${6 * uiScale}px`,
        }),
        [uiScale]
    );

    const inputStyle = useMemo(
        () => ({
            backgroundColor: t.bg.input,
            border: `1px solid ${t.border.input}`,
            borderRadius: t.radius.sm,
            color: t.text.primary,
            fontSize: 'inherit',
            outline: 'none',
            padding: `${8 * uiScale}px`,
            width: '100%',
        }),
        [uiScale]
    );

    const getFieldErrors = useCallback((field: string): string[] => {
        if (!selectedNodePath) return [];

        if (!editingAllMacrosFile) {
            const key = [...selectedNodePath, field].join('.');
            return validationErrors[key] ?? [];
        }

        const [macroIndex, ...rest] = selectedNodePath;
        if (typeof macroIndex !== 'number') return [];
        const key = `macro.${macroIndex}.${[...rest, field].join('.')}`;
        return validationErrors[key] ?? [];
    }, [editingAllMacrosFile, selectedNodePath, validationErrors]);

    const getFieldInputStyle = useCallback((field: string) => {
        const errs = getFieldErrors(field);
        return errs.length > 0 ? { ...inputStyle, border: '1px solid #ef4444' } : inputStyle;
    }, [getFieldErrors, inputStyle]);

    return useMemo(() => ({
        applyNodePatch,
        getFieldErrors,
        getFieldInputStyle,
        handleChange,
        inputStyle,
        labelStyle,
        uiScale,
    }), [applyNodePatch, getFieldErrors, getFieldInputStyle, handleChange, inputStyle, labelStyle, uiScale]);
}
