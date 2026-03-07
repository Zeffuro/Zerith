import { useMemo } from 'react';
import { useEditorStore } from '../../store/useEditorStore';
import { useScriptStore } from '../../store/useScriptStore';
import { useProjectStore } from '../../store/useProjectStore';
import { getAtPath, setAtPath } from '../../utils/scriptPathUtils';

export function useInspectorFieldEditor(index?: number | null) {
    const { uiScale, validationErrors } = useEditorStore();
    const editingAllMacrosFile = useProjectStore((s) => s.editingAllMacrosFile);
    const macroEntries = useProjectStore((s) => s.macroEntries);

    const {
        getActiveScript,
        updateActiveScript,
        selectedNodePath,
        updateNodeAtPath,
    } = useScriptStore();

    const applyNodePatch = (patch: Record<string, any>) => {
        if (editingAllMacrosFile) {
            if (!selectedNodePath || selectedNodePath.length === 0) return;
            const macroIndex = selectedNodePath[0] as number;
            const macro = macroEntries[macroIndex];
            if (!macro) return;

            if (selectedNodePath.length === 1) {
                if (patch.body !== undefined) {
                    useProjectStore.getState().updateMacroCommands(macroIndex, patch.body);
                }
                if (patch.name !== undefined && patch.name !== macro.name) {
                    useProjectStore.getState().renameMacroEntry(macroIndex, patch.name);
                }
                return;
            }

            const pathInsideMacro = selectedNodePath.slice(2);
            if (pathInsideMacro.length === 0) return;

            const currentCmd = getAtPath(macro.commands, pathInsideMacro) || {};
            const updatedCmd = { ...currentCmd, ...patch };
            const updatedCommands = setAtPath(macro.commands, pathInsideMacro, updatedCmd);

            useProjectStore.getState().updateMacroCommands(macroIndex, updatedCommands);
            return;
        }

        if (index !== null && index !== undefined) {
            const script = getActiveScript();
            const newScript = script.map((n, i) => (i === index ? { ...n, ...patch } : n));
            updateActiveScript(newScript);
            return;
        }

        if (selectedNodePath) {
            updateNodeAtPath(selectedNodePath, patch);
        }
    };

    const handleChange = (field: string, value: any) => {
        applyNodePatch({ [field]: value });
    };

    const labelStyle = useMemo(
        () => ({
            display: 'block',
            marginBottom: `${6 * uiScale}px`,
            color: '#888',
            fontSize: '0.85em',
        }),
        [uiScale]
    );

    const inputStyle = useMemo(
        () => ({
            width: '100%',
            padding: `${8 * uiScale}px`,
            backgroundColor: '#1e1e1e',
            border: '1px solid #3c3c3c',
            color: '#fff',
            borderRadius: '4px',
            fontSize: 'inherit',
            outline: 'none',
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

    return { uiScale, applyNodePatch, handleChange, labelStyle, inputStyle, getFieldErrors, getFieldInputStyle };
}