import type { JumpCommand } from 'core';

import { useInspectorFieldEditor } from '../../hooks/useInspectorFieldEditor';
import { FieldError } from './FieldError';

export function JumpInspector({ index, node }: { index?: null | number; node: JumpCommand; }) {
    const { getFieldErrors, getFieldInputStyle, handleChange, labelStyle } = useInspectorFieldEditor(index);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
                <label style={labelStyle}>Target Scene</label>
                <input
                    onChange={(event) => handleChange('to', event.target.value)}
                    placeholder="e.g. intro_courtroom"
                    style={getFieldInputStyle('to')}
                    type="text"
                    value={node.to || ''}
                />
                <FieldError errors={getFieldErrors('to')} />
            </div>
        </div>
    );
}