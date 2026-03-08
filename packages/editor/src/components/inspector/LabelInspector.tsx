import { useInspectorFieldEditor } from '../../hooks/useInspectorFieldEditor';
import { FieldError } from './FieldError';

export function LabelInspector({ index, node }: { index?: null | number; node: any; }) {
    const { getFieldErrors, getFieldInputStyle, handleChange, labelStyle } = useInspectorFieldEditor(index);
    const nameErrors = getFieldErrors('name');

    return (
        <div>
            <label style={labelStyle}>Label Name</label>
            <input
                onChange={(e) => handleChange('name', e.target.value)}
                placeholder="e.g. cross_exam_start"
                style={getFieldInputStyle('name')}
                type="text"
                value={node.name || ''}
            />
            <FieldError errors={nameErrors} />
        </div>
    );
}