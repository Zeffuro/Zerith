import type { BgmCommand } from '@zeffuro/zerith-core';

import { useInspectorFieldEditor } from '../../hooks/useInspectorFieldEditor';
import { FieldError } from './FieldError';
import { AssetPickerField } from './fields/AssetPickerField';

export function BgmInspector({ index, node }: { index?: null | number; node: BgmCommand; }) {
    const { getFieldErrors, getFieldInputStyle, handleChange, labelStyle } = useInspectorFieldEditor(index);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
                <label style={labelStyle}>Action</label>
                <select
                    onChange={(event) => handleChange('action', event.target.value)}
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
                            kind="bgm"
                            listId="bgm-asset-options"
                            onChange={(assetUrl) => handleChange('assetUrl', assetUrl)}
                            value={node.assetUrl ?? ''}
                        />
                        <FieldError errors={getFieldErrors('assetUrl')} />
                    </div>

                    <div>
                        <label style={labelStyle}>Volume (0-1)</label>
                        <input
                            onChange={(event) => handleChange('volume', Number(event.target.value))}
                            step="0.1"
                            style={getFieldInputStyle('volume')}
                            type="number"
                            value={node.volume ?? 1}
                        />
                        <FieldError errors={getFieldErrors('volume')} />
                    </div>

                    <div>
                        <label style={labelStyle}>Loop</label>
                        <input
                            checked={node.loop !== false}
                            onChange={(event) => handleChange('loop', event.target.checked)}
                            type="checkbox"
                        />
                        <FieldError errors={getFieldErrors('loop')} />
                    </div>
                </>
            )}
        </div>
    );
}