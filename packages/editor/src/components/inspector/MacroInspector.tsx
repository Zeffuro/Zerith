import type { BaseCommand } from 'core';

import { useInspectorFieldEditor } from '../../hooks/useInspectorFieldEditor';
import { FieldError } from './FieldError';

export function MacroInspector({ index, node }: { index?: null | number; node: BaseCommand; }) {
    const { getFieldErrors, getFieldInputStyle, handleChange, labelStyle, uiScale } = useInspectorFieldEditor(index);
    const macroName = typeof node.name === 'string' ? node.name : '';

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: `${12 * uiScale}px` }}>
            <div>
                <label style={labelStyle}>Macro Name</label>
                <input
                    onChange={(event) => handleChange('name', event.target.value)}
                    style={getFieldInputStyle('name')}
                    type="text"
                    value={macroName}
                />
                <FieldError errors={getFieldErrors('name')} />
                <p style={{ color: '#666', fontSize: '0.8em', fontStyle: 'italic', marginTop: '4px' }}>
                    Define macros in <b>data/macros.json</b>
                </p>
            </div>
        </div>
    );
}