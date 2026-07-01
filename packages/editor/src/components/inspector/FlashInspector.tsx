import type { FlashCommand } from 'zerith-core';

import { useInspectorFieldEditor } from '../../hooks/useInspectorFieldEditor';
import { FieldError } from './FieldError';
import { ColorPickerField } from './fields/ColorPickerField';

export function FlashInspector({ index, node }: { index?: null | number; node: FlashCommand; }) {
    const { getFieldErrors, getFieldInputStyle, handleChange, labelStyle, uiScale } = useInspectorFieldEditor(index);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
                <label style={labelStyle}>Color (Hex / Number)</label>
                <ColorPickerField
                    inputMode="number"
                    inputStyle={getFieldInputStyle('color')}
                    onChange={(_hexValue, numberValue) => handleChange('color', numberValue)}
                    uiScale={uiScale}
                    value={node.color ?? 0xFF_FF_FF}
                />
                <FieldError errors={getFieldErrors('color')} />
            </div>
            <div>
                <label style={labelStyle}>Duration (ms)</label>
                <input
                    min={0}
                    onChange={(event) => handleChange('duration', Number(event.target.value))}
                    style={getFieldInputStyle('duration')}
                    type="number"
                    value={node.duration ?? 200}
                />
                <FieldError errors={getFieldErrors('duration')} />
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