import { useEffect, useState } from 'react';
import { useInspectorFieldEditor } from '../../hooks/useInspectorFieldEditor';
import { FieldError } from './FieldError';

export function FlashInspector({ node, index }: { node: any; index?: number | null }) {
    const { labelStyle, handleChange, getFieldErrors, getFieldInputStyle, uiScale } = useInspectorFieldEditor(index);

    // Use local state to prevent lag when dragging the color picker!
    const [localColor, setLocalColor] = useState(node.color ?? 16777215);

    useEffect(() => {
        setLocalColor(node.color ?? 16777215);
    }, [node.color]);

    const hexColor = '#' + localColor.toString(16).padStart(6, '0').toUpperCase();

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
                <label style={labelStyle}>Color (Hex / Number)</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                        type="color"
                        value={hexColor}
                        onChange={(e) => setLocalColor(parseInt(e.target.value.replace('#', ''), 16))}
                        onBlur={() => handleChange('color', localColor)} // Only save to JSON when finished
                        style={{
                            width: `${32 * uiScale}px`,
                            height: `${32 * uiScale}px`,
                            padding: 0,
                            border: 'none',
                            background: 'transparent',
                            cursor: 'pointer'
                        }}
                        title="Pick Color"
                    />
                    <input
                        type="number"
                        value={localColor}
                        onChange={(e) => {
                            const val = Number(e.target.value);
                            setLocalColor(val);
                            handleChange('color', val);
                        }}
                        style={{ ...getFieldInputStyle('color'), flex: 1 }}
                    />
                </div>
                <FieldError errors={getFieldErrors('color')} />
            </div>
            <div>
                <label style={labelStyle}>Duration (ms)</label>
                <input
                    type="number"
                    min={0}
                    value={node.duration ?? 200}
                    onChange={(e) => handleChange('duration', Number(e.target.value))}
                    style={getFieldInputStyle('duration')}
                />
                <FieldError errors={getFieldErrors('duration')} />
            </div>
            <div>
                <label style={labelStyle}>Wait for completion</label>
                <select
                    value={node.wait ? 'true' : 'false'}
                    onChange={(e) => handleChange('wait', e.target.value === 'true')}
                    style={getFieldInputStyle('wait')}
                >
                    <option value="false">No</option>
                    <option value="true">Yes</option>
                </select>
                <FieldError errors={getFieldErrors('wait')} />
            </div>
        </div>
    );
}