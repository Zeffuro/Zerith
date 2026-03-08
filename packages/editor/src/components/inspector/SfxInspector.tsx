import { useInspectorFieldEditor } from '../../hooks/useInspectorFieldEditor';
import { FieldError } from './FieldError';

export function SfxInspector({ index, node }: { index?: null | number; node: any; }) {
    const { getFieldErrors, getFieldInputStyle, handleChange, labelStyle } = useInspectorFieldEditor(index);
    const assetErrors = getFieldErrors('assetUrl');
    const volumeErrors = getFieldErrors('volume');

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
                <label style={labelStyle}>Asset URL</label>
                <input
                    onChange={(e) => handleChange('assetUrl', e.target.value)}
                    placeholder="/assets/sfx/click.wav"
                    style={getFieldInputStyle('assetUrl')}
                    type="text"
                    value={node.assetUrl || ''}
                />
                <FieldError errors={assetErrors} />
            </div>

            <div>
                <label style={labelStyle}>Volume (0.0 - 1.0)</label>
                <input
                    max={1}
                    min={0}
                    onChange={(e) => handleChange('volume', Number(e.target.value))}
                    step="0.01"
                    style={getFieldInputStyle('volume')}
                    type="number"
                    value={node.volume ?? 0.8}
                />
                <FieldError errors={volumeErrors} />
            </div>
        </div>
    );
}