import { useInspectorFieldEditor } from './useInspectorFieldEditor';

export function GotoInspector({ node, index }: { node: any; index?: number | null }) {
    const { labelStyle, inputStyle, handleChange } = useInspectorFieldEditor(index);

    return (
        <div>
            <label style={labelStyle}>Target Label</label>
            <input
                type="text"
                value={node.label || ''}
                onChange={(e) => handleChange('label', e.target.value)}
                placeholder="e.g. objection_branch"
                style={inputStyle}
            />
        </div>
    );
}