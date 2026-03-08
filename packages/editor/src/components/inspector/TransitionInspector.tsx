import { useInspectorFieldEditor } from '../../hooks/useInspectorFieldEditor';
import { FieldError } from './FieldError';

export function TransitionInspector({ index, node }: { index?: null | number; node: any; }) {
    const { getFieldErrors, getFieldInputStyle, handleChange, labelStyle } = useInspectorFieldEditor(index);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
                <label style={labelStyle}>Action</label>
                <select
                    onChange={(e) => handleChange('action', e.target.value)}
                    style={getFieldInputStyle('action')}
                    value={node.action || 'fade_out'}
                >
                    <option value="fade_out">Fade Out</option>
                    <option value="fade_in">Fade In</option>
                </select>
                <FieldError errors={getFieldErrors('action')} />
            </div>

            <div>
                <label style={labelStyle}>Duration (ms)</label>
                <input
                    min={0}
                    onChange={(e) => handleChange('duration', Number(e.target.value))}
                    style={getFieldInputStyle('duration')}
                    type="number"
                    value={node.duration ?? 500}
                />
                <FieldError errors={getFieldErrors('duration')} />
            </div>
        </div>
    );
}