import { useInspectorFieldEditor } from './useInspectorFieldEditor';

export function JumpInspector({ node, index }: { node: any; index?: number | null }) {
    const { labelStyle, inputStyle, handleChange } = useInspectorFieldEditor(index);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
                <label style={labelStyle}>Target Scene</label>
                <input
                    type="text"
                    value={node.to || ''}
                    onChange={(e) => handleChange('to', e.target.value)}
                    placeholder="e.g. intro_courtroom"
                    style={inputStyle}
                />
            </div>
        </div>
    );
}