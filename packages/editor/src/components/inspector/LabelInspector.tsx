import { useInspectorFieldEditor } from './useInspectorFieldEditor';
import { FieldError } from './FieldError';

export function LabelInspector({ node, index }: { node: any; index?: number | null }) {
    const { labelStyle, handleChange, getFieldErrors, getFieldInputStyle } = useInspectorFieldEditor(index);
    const nameErrors = getFieldErrors('name');

    return (
        <div>
            <label style={labelStyle}>Label Name</label>
            <input
                type="text"
                value={node.name || ''}
                onChange={(e) => handleChange('name', e.target.value)}
                placeholder="e.g. cross_exam_start"
                style={getFieldInputStyle('name')}
            />
            <FieldError errors={nameErrors} />
        </div>
    );
}