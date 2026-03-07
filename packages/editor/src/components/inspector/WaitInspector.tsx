import { useInspectorFieldEditor } from './useInspectorFieldEditor';
import { FieldError } from './FieldError';

export function WaitInspector({ node, index }: { node: any; index?: number | null }) {
    const { labelStyle, handleChange, getFieldErrors, getFieldInputStyle } = useInspectorFieldEditor(index);

    return (
        <div>
            <label style={labelStyle}>Duration (ms)</label>
            <input
                type="number"
                min={0}
                value={node.duration ?? 500}
                onChange={(e) => handleChange('duration', Number(e.target.value))}
                style={getFieldInputStyle('duration')}
            />
            <FieldError errors={getFieldErrors('duration')} />
        </div>
    );
}