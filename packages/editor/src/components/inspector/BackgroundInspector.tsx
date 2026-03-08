import type { BackgroundCommand } from 'core';
import { useInspectorFieldEditor } from '../../hooks/useInspectorFieldEditor';
import { FieldError } from './FieldError';
import { AssetPickerField } from './fields/AssetPickerField';

export function BackgroundInspector({ index, node }: { index?: null | number; node: BackgroundCommand; }) {
    const { getFieldErrors, getFieldInputStyle, handleChange, labelStyle } = useInspectorFieldEditor(index);
    const assetErrors = getFieldErrors('assetUrl');

    return (
        <div>
            <label style={labelStyle}>Asset URL</label>
            <AssetPickerField
                inputStyle={getFieldInputStyle('assetUrl')}
                kind="bg"
                listId="bg-asset-options"
                onChange={(assetUrl) => handleChange('assetUrl', assetUrl)}
                value={node.assetUrl ?? ''}
            />
            <FieldError errors={assetErrors} />
        </div>
    );
}