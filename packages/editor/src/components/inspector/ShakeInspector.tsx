import type { ShakeCommand } from '@zeffuro/zerith-core';

import { useInspectorFieldEditor } from '../../hooks/useInspectorFieldEditor';
import { FieldError } from './FieldError';

export function ShakeInspector({ index, node }: { index?: null | number; node: ShakeCommand; }) {
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
            <div>
                <label style={labelStyle}>Intensity</label>
                <input
                    onChange={(event) => handleChange('intensity', Number(event.target.value))}
                    step="1"
                    style={getFieldInputStyle('intensity')}
                    type="number"
                    value={node.intensity ?? 10}
                />
                <FieldError errors={getFieldErrors('intensity')} />
            </div>
            <div>
                <label style={labelStyle}>Wait for completion</label>
                <select
                    onChange={(event) => handleChange('wait', event.target.value === 'true')}
                    style={getFieldInputStyle('wait')}
                    value={node.wait ? 'true' : 'false'}
                >
                    <option value="false">No</option>
                    <option value="true">Yes</option>
                </select>
                <FieldError errors={getFieldErrors('wait')} />
            </div>
        </div>
    );
}