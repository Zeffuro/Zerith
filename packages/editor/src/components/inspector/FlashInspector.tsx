import type { FlashCommand } from 'core';

import { useState } from 'react';

import { useInspectorFieldEditor } from '../../hooks/useInspectorFieldEditor';
import { FieldError } from './FieldError';

export function FlashInspector({ index, node }: { index?: null | number; node: FlashCommand; }) {
    const { getFieldErrors, getFieldInputStyle, handleChange, labelStyle, uiScale } = useInspectorFieldEditor(index);

    const [localColor, setLocalColor] = useState(node.color ?? 0xFF_FF_FF);
    const [previousColor, setPreviousColor] = useState(node.color);

    if (node.color !== previousColor) {
        setPreviousColor(node.color);
        setLocalColor(node.color ?? 0xFF_FF_FF);
    }

    const hexColor = '#' + localColor.toString(16).padStart(6, '0').toUpperCase();

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
                <label style={labelStyle}>Color (Hex / Number)</label>
                <div style={{ alignItems: 'center', display: 'flex', gap: '8px' }}>
                    <input
                        onBlur={() => handleChange('color', localColor)} // Only save to JSON when finished
                        onChange={(event) => setLocalColor(Number.parseInt(event.target.value.replace('#', ''), 16))}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            height: `${32 * uiScale}px`,
                            padding: 0,
                            width: `${32 * uiScale}px`
                        }}
                        title="Pick Color"
                        type="color"
                        value={hexColor}
                    />
                    <input
                        onChange={(event) => {
                            const value = Number(event.target.value);
                            setLocalColor(value);
                            handleChange('color', value);
                        }}
                        style={{ ...getFieldInputStyle('color'), flex: 1 }}
                        type="number"
                        value={localColor}
                    />
                </div>
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