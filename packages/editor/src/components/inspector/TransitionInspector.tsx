import type { TransitionCommand } from '@zeffuro/zerith-core';

import { useInspectorFieldEditor } from '../../hooks/useInspectorFieldEditor';
import { FieldError } from './FieldError';

export function TransitionInspector({ index, node }: { index?: null | number; node: TransitionCommand; }) {
    const { getFieldErrors, getFieldInputStyle, handleChange, labelStyle } = useInspectorFieldEditor(index);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
                <label style={labelStyle}>Action</label>
                <select
                    onChange={(event) => handleChange('action', event.target.value)}
                    style={getFieldInputStyle('action')}
                    value={node.action || 'fadein'}
                >
                    <option value="fadein">Fade In (Transparent)</option>
                    <option value="fadeout">Fade Out (Black)</option>
                </select>
                <FieldError errors={getFieldErrors('action')} />
            </div>

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