import type { WaitCommand } from 'core';

import { useInspectorFieldEditor } from '../../hooks/useInspectorFieldEditor';
import { FieldError } from './FieldError';

export function WaitInspector({ index, node }: { index?: null | number; node: WaitCommand; }) {
    const { getFieldErrors, getFieldInputStyle, handleChange, labelStyle } = useInspectorFieldEditor(index);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
                <label style={labelStyle}>Duration (ms)</label>
                <input
                    min={0}
                    onChange={(event) => handleChange('duration', Number(event.target.value))}
                    style={getFieldInputStyle('duration')}
                    type="number"
                    value={node.duration ?? 500}
                />
                <FieldError errors={getFieldErrors('duration')} />
            </div>
        </div>
    );
}