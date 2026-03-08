import { useInspectorFieldEditor } from '../../hooks/useInspectorFieldEditor';
import { FieldError } from './FieldError';

export function WaitInspector({ index, node }: { index?: null | number; node: any; }) {
    const { getFieldErrors, getFieldInputStyle, handleChange, labelStyle } = useInspectorFieldEditor(index);

    return (
        <div>
            <label style={labelStyle}>Duration (ms)</label>
            <input
                min={0}
                onChange={(e) => handleChange('duration', Number(e.target.value))}
                style={getFieldInputStyle('duration')}
                type="number"
                value={node.duration ?? 500}
            />
            <FieldError errors={getFieldErrors('duration')} />
        </div>
    );
}