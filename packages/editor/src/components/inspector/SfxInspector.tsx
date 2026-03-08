import type { SfxCommand } from 'core';

import { useInspectorFieldEditor } from '../../hooks/useInspectorFieldEditor';
import { FieldError } from './FieldError';
import { AssetPickerField } from './fields/AssetPickerField';

export function SfxInspector({ index, node }: { index?: null | number; node: SfxCommand; }) {
    const { getFieldErrors, getFieldInputStyle, handleChange, labelStyle } = useInspectorFieldEditor(index);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
                <label style={labelStyle}>Asset URL</label>
                <AssetPickerField
                    inputStyle={getFieldInputStyle('assetUrl')}
                    kind="sfx"
                    listId="sfx-asset-options"
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
        </div>
    );
}