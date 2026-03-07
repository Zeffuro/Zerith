import { useInspectorFieldEditor } from './useInspectorFieldEditor';
import { FieldError } from './FieldError';

export function BackgroundInspector({ node, index }: { node: any; index?: number | null }) {
    const { labelStyle, handleChange, getFieldErrors, getFieldInputStyle } = useInspectorFieldEditor(index);
    const assetErrors = getFieldErrors('assetUrl');

    return (
        <div>
            <label style={labelStyle}>Asset URL</label>
            <input
                type="text"
                value={node.assetUrl || ''}
                onChange={(e) => handleChange('assetUrl', e.target.value)}
                placeholder="/assets/bg/courtroom.png"
                style={getFieldInputStyle('assetUrl')}
            />
            <FieldError errors={assetErrors} />
        </div>
    );
}