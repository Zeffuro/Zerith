import { useInspectorFieldEditor } from './useInspectorFieldEditor';

export function LabelInspector({ node, index }: { node: any; index?: number | null }) {
    const { labelStyle, inputStyle, handleChange } = useInspectorFieldEditor(index);

    return (
        <div>
            <label style={labelStyle}>Label Name</label>
            <input
                type="text"
                value={node.name || ''}
                onChange={(e) => handleChange('name', e.target.value)}
                placeholder="e.g. cross_exam_start"
                style={inputStyle}
            />
        </div>
    );
}