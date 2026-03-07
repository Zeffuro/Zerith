import { useMemo } from 'react';
import { useEditorStore } from '../../store/useEditorStore';
import { useScriptStore } from '../../store/useScriptStore';
import { useProjectStore } from '../../store/useProjectStore';
import { setAtPath, getAtPath } from '../../utils/scriptPathUtils';

export function useInspectorFieldEditor(index?: number | null) {
    const { uiScale, validationErrors } = useEditorStore();
    const editingAllMacrosFile = useProjectStore((s) => s.editingAllMacrosFile);
    const macroEntries = useProjectStore((s) => s.macroEntries);
    const setMacroEntries = useProjectStore((s) => s.setMacroEntries);

    const {
        getActiveScript,
        updateActiveScript,
        selectedNodePath,
        updateNodeAtPath,
    } = useScriptStore();

    const handleChange = (field: string, value: any) => {
        if (editingAllMacrosFile && selectedNodePath && typeof selectedNodePath[0] === 'number') {
            const macroIndex = selectedNodePath[0] as number;
            const rest = selectedNodePath.slice(1);
            const curr = macroEntries[macroIndex];
            if (!curr) return;

            if (rest.length === 0 && field === 'name') {
                const next = [...macroEntries];
                next[macroIndex] = { ...curr, name: value };
                setMacroEntries(next);
                return;
            }

            const targetPath = rest;
            const targetNode = getAtPath<any>({ type: 'macro_header', name: curr.name, body: curr.commands }, targetPath);
            if (!targetNode || typeof targetNode !== 'object') return;

            const patched = { ...targetNode, [field]: value };
            const updatedSynthetic = setAtPath({ type: 'macro_header', name: curr.name, body: curr.commands }, targetPath, patched);

            const next = [...macroEntries];
            next[macroIndex] = { ...curr, commands: Array.isArray(updatedSynthetic.body) ? updatedSynthetic.body : curr.commands };
            setMacroEntries(next);
            return;
        }

        if (index !== null && index !== undefined) {
            const script = getActiveScript();
            const newScript = script.map((n, i) => (i === index ? { ...n, [field]: value } : n));
            updateActiveScript(newScript);
            return;
        }

        if (selectedNodePath) {
            updateNodeAtPath(selectedNodePath, { [field]: value });
        }
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
        if (!selectedNodePath) return [];

        if (!editingAllMacrosFile) {
            const key = [...selectedNodePath, field].join('.');
            return validationErrors[key] ?? [];
        }

        const [macroIndex, ...rest] = selectedNodePath;
        if (typeof macroIndex !== 'number') return [];
        const key = `macro.${macroIndex}.${[...rest, field].join('.')}`;
        return validationErrors[key] ?? [];
    };

    const getFieldInputStyle = (field: string) => {
        const errs = getFieldErrors(field);
        return errs.length > 0 ? { ...inputStyle, border: '1px solid #ef4444' } : inputStyle;
    };

    return { uiScale, handleChange, labelStyle, inputStyle, getFieldErrors, getFieldInputStyle };
}