import { useInspectorFieldEditor } from './useInspectorFieldEditor';

export function ShakeInspector({ node, index }: { node: any; index?: number | null }) {
    const { labelStyle, inputStyle, handleChange } = useInspectorFieldEditor(index);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
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
            <div>
                <label style={labelStyle}>Intensity</label>
                <input
                    type="number"
                    min={0}
                    value={node.intensity ?? 10}
                    onChange={(e) => handleChange('intensity', Number(e.target.value))}
                    style={inputStyle}
                />
            </div>
            <div>
                <label style={labelStyle}>Wait for completion</label>
                <select
                    value={node.wait ? 'true' : 'false'}
                    onChange={(e) => handleChange('wait', e.target.value === 'true')}
                    style={inputStyle}
                >
                    <option value="false">No</option>
                    <option value="true">Yes</option>
                </select>
            </div>
        </div>
    );
}