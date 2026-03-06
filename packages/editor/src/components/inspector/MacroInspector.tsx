import { useProjectStore } from '../../store/useProjectStore';
import { useInspectorFieldEditor } from './useInspectorFieldEditor';

export function MacroInspector({ node, index }: { node: any, index?: number | null }) {
    const { macros } = useProjectStore();
    const { uiScale, handleChange, labelStyle, inputStyle } = useInspectorFieldEditor(index);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: `${12 * uiScale}px` }}>
            <div>
                <label style={labelStyle}>Macro Name</label>
                <select
                    value={node.name || ''}
                    onChange={e => handleChange('name', e.target.value)}
                    style={inputStyle}
                >
                    <option value="">(Select Macro)</option>
                    {Object.keys(macros).map(m => (
                        <option key={m} value={m}>{m}</option>
                    ))}
                </select>
                <p style={{ color: '#666', fontSize: '0.8em', marginTop: '4px', fontStyle: 'italic' }}>
                    Define macros in <b>data/macros.json</b>
                </p>
            </div>
        </div>
    );
}