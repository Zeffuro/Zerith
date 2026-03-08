import type { GotoCommand } from 'core';

import { useInspectorFieldEditor } from '../../hooks/useInspectorFieldEditor';
import { FieldError } from './FieldError';

export function GotoInspector({ index, node }: { index?: null | number; node: GotoCommand; }) {
    const { getFieldErrors, getFieldInputStyle, handleChange, labelStyle } = useInspectorFieldEditor(index);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
                <label style={labelStyle}>Label Name</label>
                <input
                    onChange={(event) => handleChange('label', event.target.value)}
                    style={getFieldInputStyle('label')}
                    type="text"
                    value={node.label || ''}
                />
                <FieldError errors={getFieldErrors('label')} />
            </div>
        </div>
    );
}