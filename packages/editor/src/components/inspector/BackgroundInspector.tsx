import { useInspectorFieldEditor } from './useInspectorFieldEditor';
import { FieldError } from './FieldError';
import { AssetPickerField } from './fields/AssetPickerField';

export function BackgroundInspector({ node, index }: { node: any; index?: number | null }) {
    const { labelStyle, handleChange, getFieldErrors, getFieldInputStyle } = useInspectorFieldEditor(index);
    const assetErrors = getFieldErrors('assetUrl');

    return (
        <div>
            <label style={labelStyle}>Asset URL</label>
            <AssetPickerField
                kind="bg"
                value={node.assetUrl ?? ''}
                onChange={(assetUrl) => handleChange('assetUrl', assetUrl)}
                inputStyle={getFieldInputStyle('assetUrl')}
                listId="bg-asset-options"
            />
            <FieldError errors={assetErrors} />
        </div>
    );
}