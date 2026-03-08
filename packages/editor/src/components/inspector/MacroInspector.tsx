import { useInspectorFieldEditor } from '../../hooks/useInspectorFieldEditor';
import { useProjectStore } from '../../store/useProjectStore';
import { FieldError } from './FieldError';

export function MacroInspector({ index, node }: { index?: null | number; node: any, }) {
    const { macros } = useProjectStore();
    const { getFieldErrors, getFieldInputStyle, handleChange, labelStyle, uiScale } = useInspectorFieldEditor(index);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: `${12 * uiScale}px` }}>
            <div>
                <label style={labelStyle}>Macro Name</label>
                <select
                    onChange={e => handleChange('name', e.target.value)}
                    style={getFieldInputStyle('name')}
                    value={node.name || ''}
                >
                    <option value="">(Select Macro)</option>
                    {Object.keys(macros).map(m => (
                        <option key={m} value={m}>{m}</option>
                    ))}
                </select>
                <FieldError errors={getFieldErrors('name')} />
                <p style={{ color: '#666', fontSize: '0.8em', fontStyle: 'italic', marginTop: '4px' }}>
                    Define macros in <b>data/macros.json</b>
                </p>
            </div>
        </div>
    );
}