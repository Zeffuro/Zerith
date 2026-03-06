import { useInspectorFieldEditor } from './useInspectorFieldEditor';

export function WaitInspector({ node, index }: { node: any; index?: number | null }) {
    const { labelStyle, inputStyle, handleChange } = useInspectorFieldEditor(index);

    return (
        <div>
            <label style={labelStyle}>Duration (ms)</label>
            <input
                type="number"
                min={0}
                value={node.duration ?? 500}
                onChange={(e) => handleChange('duration', Number(e.target.value))}
                style={inputStyle}
            />
        </div>
    );
}