import { useProjectStore } from '../../store/useProjectStore';

export function MacroInspector({ node, index }: { node: any, index: number }) {
    const updateScript = useProjectStore(state => state.updateScript);
    const script = useProjectStore(state => state.script);
    const macros = useProjectStore(state => state.macros);
    const uiScale = useProjectStore(state => state.uiScale);

    const handleChange = (field: string, value: any) => {
        const newScript = script.map((n, i) => i === index ? { ...n, [field]: value } : n);
        updateScript(newScript);
    };

    const labelStyle = { display: 'block', marginBottom: `${6 * uiScale}px`, color: '#888', fontSize: '0.85em' };
    const inputStyle = { width: '100%', padding: `${8 * uiScale}px`, backgroundColor: '#1e1e1e', border: '1px solid #3c3c3c', color: '#fff', borderRadius: '4px', fontSize: 'inherit', outline: 'none' };

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