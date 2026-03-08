import { useInspectorFieldEditor } from '../../hooks/useInspectorFieldEditor';
import { FieldError } from './FieldError';

export function JumpInspector({ node, index }: { node: any; index?: number | null }) {
    const { labelStyle, handleChange, getFieldErrors, getFieldInputStyle } = useInspectorFieldEditor(index);
    const toErrors = getFieldErrors('to');

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
                <label style={labelStyle}>Target Scene</label>
                <input
                    type="text"
                    value={node.to || ''}
                    onChange={(e) => handleChange('to', e.target.value)}
                    placeholder="e.g. intro_courtroom"
                    style={getFieldInputStyle('to')}
                />
                <FieldError errors={toErrors} />
            </div>
        </div>
    );
}