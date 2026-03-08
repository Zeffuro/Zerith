import { useMemo } from 'react';

import { executeInspectorFieldPatchAction } from '../store/actions/inspectorFieldActions';
import { useEditorStore } from '../store/useEditorStore';
import { useProjectStore } from '../store/useProjectStore';
import { useScriptStore } from '../store/useScriptStore';

export function useInspectorFieldEditor(index?: null | number) {
    const { uiScale, validationErrors } = useEditorStore();
    const editingAllMacrosFile = useProjectStore((s) => s.editingAllMacrosFile);

    const {
        selectedNodePath,
    } = useScriptStore();

    const applyNodePatch = (patch: Record<string, any>) => {
        executeInspectorFieldPatchAction({ index, patch });
    };

    const handleChange = (field: string, value: any) => {
        applyNodePatch({ [field]: value });
    };

    const labelStyle = useMemo(
        () => ({
            color: '#888',
            display: 'block',
            fontSize: '0.85em',
            marginBottom: `${6 * uiScale}px`,
        }),
        [uiScale]
    );

    const inputStyle = useMemo(
        () => ({
            backgroundColor: '#1e1e1e',
            border: '1px solid #3c3c3c',
            borderRadius: '4px',
            color: '#fff',
            fontSize: 'inherit',
            outline: 'none',
            padding: `${8 * uiScale}px`,
            width: '100%',
        }),
        [uiScale]
    );

    const getFieldErrors = (field: string): string[] => {
        if (!selectedNodePath) return[];

        if (!editingAllMacrosFile) {
            const key = [...selectedNodePath, field].join('.');
            return validationErrors[key] ?? [];
        }

        const [macroIndex, ...rest] = selectedNodePath;
        if (typeof macroIndex !== 'number') return [];
        const key = `macro.${macroIndex}.${[...rest, field].join('.')}`;
        return validationErrors[key] ??[];
    };

    const getFieldInputStyle = (field: string) => {
        const errs = getFieldErrors(field);
        return errs.length > 0 ? { ...inputStyle, border: '1px solid #ef4444' } : inputStyle;
    };

    return { applyNodePatch, getFieldErrors, getFieldInputStyle, handleChange, inputStyle, labelStyle, uiScale };
}
