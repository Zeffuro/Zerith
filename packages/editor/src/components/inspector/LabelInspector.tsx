import type { LabelCommand } from 'zerith-core';

import { useInspectorFieldEditor } from '../../hooks/useInspectorFieldEditor';
import { FieldError } from './FieldError';

export function LabelInspector({ index, node }: { index?: null | number; node: LabelCommand; }) {
    const { getFieldErrors, getFieldInputStyle, handleChange, labelStyle } = useInspectorFieldEditor(index);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
                <label style={labelStyle}>Label Name</label>
                <input
                    onChange={(event) => handleChange('name', event.target.value)}
                    style={getFieldInputStyle('name')}
                    type="text"
                    value={node.name || ''}
                />
                <FieldError errors={getFieldErrors('name')} />
            </div>
        </div>
    );
}