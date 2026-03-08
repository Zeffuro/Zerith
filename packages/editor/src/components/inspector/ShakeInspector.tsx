import { useInspectorFieldEditor } from '../../hooks/useInspectorFieldEditor';
import { FieldError } from './FieldError';

export function ShakeInspector({ node, index }: { node: any; index?: number | null }) {
    const { labelStyle, handleChange, getFieldErrors, getFieldInputStyle } = useInspectorFieldEditor(index);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
                <label style={labelStyle}>Duration (ms)</label>
                <input
                    type="number"
                    min={0}
                    value={node.duration ?? 500}
                    onChange={(e) => handleChange('duration', Number(e.target.value))}
                    style={getFieldInputStyle('duration')}
                />
                <FieldError errors={getFieldErrors('duration')} />
            </div>
            <div>
                <label style={labelStyle}>Intensity</label>
                <input
                    type="number"
                    min={0}
                    value={node.intensity ?? 10}
                    onChange={(e) => handleChange('intensity', Number(e.target.value))}
                    style={getFieldInputStyle('intensity')}
                />
                <FieldError errors={getFieldErrors('intensity')} />
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