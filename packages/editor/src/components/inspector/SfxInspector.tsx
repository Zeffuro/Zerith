import { useInspectorFieldEditor } from '../../hooks/useInspectorFieldEditor';
import { FieldError } from './FieldError';

export function SfxInspector({ node, index }: { node: any; index?: number | null }) {
    const { labelStyle, handleChange, getFieldErrors, getFieldInputStyle } = useInspectorFieldEditor(index);
    const assetErrors = getFieldErrors('assetUrl');
    const volumeErrors = getFieldErrors('volume');

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
                <label style={labelStyle}>Asset URL</label>
                <input
                    type="text"
                    value={node.assetUrl || ''}
                    onChange={(e) => handleChange('assetUrl', e.target.value)}
                    placeholder="/assets/sfx/click.wav"
                    style={getFieldInputStyle('assetUrl')}
                />
                <FieldError errors={assetErrors} />
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
                    style={getFieldInputStyle('volume')}
                />
                <FieldError errors={volumeErrors} />
            </div>
        </div>
    );
}