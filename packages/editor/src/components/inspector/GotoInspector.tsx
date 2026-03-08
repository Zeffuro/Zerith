import { useInspectorFieldEditor } from '../../hooks/useInspectorFieldEditor';
import { FieldError } from './FieldError';

export function GotoInspector({ index, node }: { index?: null | number; node: any; }) {
    const { getFieldErrors, getFieldInputStyle, handleChange, labelStyle } = useInspectorFieldEditor(index);
    const labelErrors = getFieldErrors('label');

    return (
        <div>
            <label style={labelStyle}>Target Label</label>
            <input
                onChange={(e) => handleChange('label', e.target.value)}
                placeholder="e.g. objection_branch"
                style={getFieldInputStyle('label')}
                type="text"
                value={node.label || ''}
            />
            <FieldError errors={labelErrors} />
        </div>
    );
}