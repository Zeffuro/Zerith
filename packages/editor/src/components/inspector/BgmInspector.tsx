import { useInspectorFieldEditor } from '../../hooks/useInspectorFieldEditor';
import { FieldError } from './FieldError';
import { AssetPickerField } from './fields/AssetPickerField';

export function BgmInspector({ index, node }: { index?: null | number; node: any; }) {
    const { getFieldErrors, getFieldInputStyle, handleChange, labelStyle } = useInspectorFieldEditor(index);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
                <label style={labelStyle}>Action</label>
                <select
                    onChange={(e) => handleChange('action', e.target.value)}
                    style={getFieldInputStyle('action')}
                    value={node.action || 'play'}
                >
                    <option value="play">Play</option>
                    <option value="stop">Stop</option>
                    <option value="pause">Pause</option>
                    <option value="resume">Resume</option>
                </select>
                <FieldError errors={getFieldErrors('action')} />
            </div>

            {node.action === 'play' && (
                <>
                    <div>
                        <label style={labelStyle}>Asset URL</label>
                        <AssetPickerField
                            inputStyle={getFieldInputStyle('assetUrl')}
                            kind="audio"
                            listId="bgm-asset-options"
                            onChange={(assetUrl) => handleChange('assetUrl', assetUrl)}
                            value={node.assetUrl || ''}
                        />
                        <FieldError errors={getFieldErrors('assetUrl')} />
                    </div>

                    <div>
                        <label style={labelStyle}>Volume (0-1)</label>
                        <input
                            max={1}
                            min={0}
                            onChange={(e) => handleChange('volume', Number(e.target.value))}
                            step="0.01"
                            style={getFieldInputStyle('volume')}
                            type="number"
                            value={node.volume ?? 0.5}
                        />
                        <FieldError errors={getFieldErrors('volume')} />
                    </div>

                    <div>
                        <label style={labelStyle}>Loop</label>
                        <select
                            onChange={(e) => handleChange('loop', e.target.value === 'true')}
                            style={getFieldInputStyle('loop')}
                            value={node.loop ? 'true' : 'false'}
                        >
                            <option value="true">true</option>
                            <option value="false">false</option>
                        </select>
                        <FieldError errors={getFieldErrors('loop')} />
                    </div>
                </>
            )}
        </div>
    );
}