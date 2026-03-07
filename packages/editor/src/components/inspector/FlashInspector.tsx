import { useInspectorFieldEditor } from './useInspectorFieldEditor';
import { FieldError } from './FieldError';

export function FlashInspector({ node, index }: { node: any; index?: number | null }) {
    const { labelStyle, handleChange, getFieldErrors, getFieldInputStyle } = useInspectorFieldEditor(index);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
                <label style={labelStyle}>Color (number, hex int)</label>
                <input
                    type="number"
                    value={node.color ?? 16777215}
                    onChange={(e) => handleChange('color', Number(e.target.value))}
                    style={getFieldInputStyle('color')}
                />
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