import { useInspectorFieldEditor } from '../../hooks/useInspectorFieldEditor';
import { FieldError } from './FieldError';

export function JumpInspector({ index, node }: { index?: null | number; node: any; }) {
    const { getFieldErrors, getFieldInputStyle, handleChange, labelStyle } = useInspectorFieldEditor(index);
    const toErrors = getFieldErrors('to');

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
                <label style={labelStyle}>Target Scene</label>
                <input
                    onChange={(e) => handleChange('to', e.target.value)}
                    placeholder="e.g. intro_courtroom"
                    style={getFieldInputStyle('to')}
                    type="text"
                    value={node.to || ''}
                />
                <FieldError errors={toErrors} />
            </div>
        </div>
    );
}