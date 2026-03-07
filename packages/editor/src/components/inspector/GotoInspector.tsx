import { useInspectorFieldEditor } from './useInspectorFieldEditor';
import { FieldError } from './FieldError';

export function GotoInspector({ node, index }: { node: any; index?: number | null }) {
    const { labelStyle, handleChange, getFieldErrors, getFieldInputStyle } = useInspectorFieldEditor(index);
    const labelErrors = getFieldErrors('label');

    return (
        <div>
            <label style={labelStyle}>Target Label</label>
            <input
                type="text"
                value={node.label || ''}
                onChange={(e) => handleChange('label', e.target.value)}
                placeholder="e.g. objection_branch"
                style={getFieldInputStyle('label')}
            />
            <FieldError errors={labelErrors} />
        </div>
    );
}