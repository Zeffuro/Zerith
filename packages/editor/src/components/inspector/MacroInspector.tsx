import type { MacroCommand } from 'core';
import { useInspectorFieldEditor } from '../../hooks/useInspectorFieldEditor';
import { FieldError } from './FieldError';

export function MacroInspector({ index, node }: { index?: null | number; node: MacroCommand; }) {
    const { getFieldErrors, getFieldInputStyle, handleChange, labelStyle, uiScale } = useInspectorFieldEditor(index);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: `${12 * uiScale}px` }}>
            <div>
                <label style={labelStyle}>Macro Name</label>
                <input
                    onChange={(event) => handleChange('name', event.target.value)}
                    style={getFieldInputStyle('name')}
                    type="text"
                    value={node.name || ''}
                />
                <FieldError errors={getFieldErrors('name')} />
                <p style={{ color: '#666', fontSize: '0.8em', fontStyle: 'italic', marginTop: '4px' }}>
                    Define macros in <b>data/macros.json</b>
                </p>
            </div>
        </div>
    );
}