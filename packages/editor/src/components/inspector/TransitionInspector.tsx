import { useInspectorFieldEditor } from './useInspectorFieldEditor';

export function TransitionInspector({ node, index }: { node: any; index?: number | null }) {
    const { labelStyle, inputStyle, handleChange } = useInspectorFieldEditor(index);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
                <label style={labelStyle}>Action</label>
                <select
                    value={node.action || 'fade_out'}
                    onChange={(e) => handleChange('action', e.target.value)}
                    style={inputStyle}
                >
                    <option value="fade_out">Fade Out</option>
                    <option value="fade_in">Fade In</option>
                </select>
            </div>

            <div>
                <label style={labelStyle}>Duration (ms)</label>
                <input
                    type="number"
                    min={0}
                    value={node.duration ?? 500}
                    onChange={(e) => handleChange('duration', Number(e.target.value))}
                    style={inputStyle}
                />
            </div>
        </div>
    );
}