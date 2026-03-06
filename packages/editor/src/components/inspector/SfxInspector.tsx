import { useInspectorFieldEditor } from './useInspectorFieldEditor';

export function SfxInspector({ node, index }: { node: any; index?: number | null }) {
    const { labelStyle, inputStyle, handleChange } = useInspectorFieldEditor(index);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
                <label style={labelStyle}>Asset URL</label>
                <input
                    type="text"
                    value={node.assetUrl || ''}
                    onChange={(e) => handleChange('assetUrl', e.target.value)}
                    placeholder="/assets/sfx/click.wav"
                    style={inputStyle}
                />
            </div>

            <div>
                <label style={labelStyle}>Volume (0.0 - 1.0)</label>
                <input
                    type="number"
                    step="0.01"
                    min={0}
                    max={1}
                    value={node.volume ?? 0.8}
                    onChange={(e) => handleChange('volume', Number(e.target.value))}
                    style={inputStyle}
                />
            </div>
        </div>
    );
}