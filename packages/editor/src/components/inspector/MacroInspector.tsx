import { useProjectStore } from '../../store/useProjectStore';
import { useInspectorFieldEditor } from './useInspectorFieldEditor';
import { FieldError } from './FieldError';

export function MacroInspector({ node, index }: { node: any, index?: number | null }) {
    const { macros } = useProjectStore();
    const { uiScale, handleChange, labelStyle, getFieldErrors, getFieldInputStyle } = useInspectorFieldEditor(index);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: `${12 * uiScale}px` }}>
            <div>
                <label style={labelStyle}>Macro Name</label>
                <select
                    value={node.name || ''}
                    onChange={e => handleChange('name', e.target.value)}
                    style={getFieldInputStyle('name')}
                >
                    <option value="">(Select Macro)</option>
                    {Object.keys(macros).map(m => (
                        <option key={m} value={m}>{m}</option>
                    ))}
                </select>
                <FieldError errors={getFieldErrors('name')} />
                <p style={{ color: '#666', fontSize: '0.8em', marginTop: '4px', fontStyle: 'italic' }}>
                    Define macros in <b>data/macros.json</b>
                </p>
            </div>
        </div>
    );
}