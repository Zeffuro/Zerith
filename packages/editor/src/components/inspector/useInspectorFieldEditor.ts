import { useMemo } from 'react';
import { useEditorStore } from '../../store/useEditorStore';
import { useScriptStore } from '../../store/useScriptStore';

export function useInspectorFieldEditor(index?: number | null) {
    const { uiScale } = useEditorStore();
    const {
        getActiveScript,
        updateActiveScript,
        selectedNodePath,
        updateNodeAtPath,
    } = useScriptStore();

    const handleChange = (field: string, value: any) => {
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

    return { uiScale, handleChange, labelStyle, inputStyle };
}