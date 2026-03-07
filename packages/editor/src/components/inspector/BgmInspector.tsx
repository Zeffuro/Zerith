import { useInspectorFieldEditor } from './useInspectorFieldEditor';
import { FieldError } from './FieldError';
import { AssetPickerField } from './fields/AssetPickerField';

export function BgmInspector({ node, index }: { node: any; index?: number | null }) {
    const { labelStyle, handleChange, getFieldErrors, getFieldInputStyle } = useInspectorFieldEditor(index);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
                <label style={labelStyle}>Action</label>
                <select
                    value={node.action || 'play'}
                    onChange={(e) => handleChange('action', e.target.value)}
                    style={getFieldInputStyle('action')}
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
                            kind="audio"
                            value={node.assetUrl || ''}
                            onChange={(assetUrl) => handleChange('assetUrl', assetUrl)}
                            inputStyle={getFieldInputStyle('assetUrl')}
                            listId="bgm-asset-options"
                        />
                        <FieldError errors={getFieldErrors('assetUrl')} />
                    </div>

                    <div>
                        <label style={labelStyle}>Volume (0-1)</label>
                        <input
                            type="number"
                            step="0.01"
                            min={0}
                            max={1}
                            value={node.volume ?? 0.5}
                            onChange={(e) => handleChange('volume', Number(e.target.value))}
                            style={getFieldInputStyle('volume')}
                        />
                        <FieldError errors={getFieldErrors('volume')} />
                    </div>

                    <div>
                        <label style={labelStyle}>Loop</label>
                        <select
                            value={node.loop ? 'true' : 'false'}
                            onChange={(e) => handleChange('loop', e.target.value === 'true')}
                            style={getFieldInputStyle('loop')}
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