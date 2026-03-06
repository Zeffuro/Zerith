import { useProjectStore } from '../../store/useProjectStore';
import { ArrowRight } from 'lucide-react';

export function IfInspector({ node, index }: { node: any, index: number }) {
    const updateScript = useProjectStore(state => state.updateScript);
    const script = useProjectStore(state => state.getActiveScript());
    const pushScope = useProjectStore(state => state.pushScope);
    const uiScale = useProjectStore(state => state.uiScale);

    const handleChange = (field: string, value: any) => {
        const newScript = script.map((n, i) => i === index ? { ...n, [field]: value } : n);
        updateScript(newScript);
    };

    const labelStyle = { display: 'block', marginBottom: `${6 * uiScale}px`, color: '#888', fontSize: '0.85em' };
    const inputStyle = { width: '100%', padding: `${8 * uiScale}px`, backgroundColor: '#1e1e1e', border: '1px solid #3c3c3c', color: '#fff', borderRadius: '4px', fontSize: 'inherit', outline: 'none' };
    const btnStyle = { width: '100%', padding: `${8 * uiScale}px`, backgroundColor: '#333', border: 'none', color: '#fff', borderRadius: '4px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: `${12 * uiScale}px` }}>
            <div>
                <label style={labelStyle}>Condition Source</label>
                <select
                    value={node.source || 'variable'}
                    onChange={e => handleChange('source', e.target.value)}
                    style={inputStyle}
                >
                    <option value="variable">Game Variable</option>
                    <option value="items">Items Inventory</option>
                </select>
            </div>

            <div>
                <label style={labelStyle}>Key / ID</label>
                <input
                    type="text"
                    value={node.key || ''}
                    onChange={e => handleChange('key', e.target.value)}
                    placeholder="e.g. has_met_bob"
                    style={inputStyle}
                />
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
                <div style={{ flex: 1 }}>
                    <label style={labelStyle}>Operator</label>
                    <select value={node.op || 'eq'} onChange={e => handleChange('op', e.target.value)} style={inputStyle}>
                        <option value="eq">== (Equal)</option>
                        <option value="neq">!= (Not Equal)</option>
                        <option value="gt">&gt; (Greater)</option>
                        <option value="lt">&lt; (Less)</option>
                    </select>
                </div>
                <div style={{ flex: 1 }}>
                    <label style={labelStyle}>Value</label>
                    <input
                        type="text"
                        value={node.value !== undefined ? node.value : ''}
                        onChange={e => {
                            // Basic type inference
                            let v: any = e.target.value;
                            if (v === 'true') v = true;
                            else if (v === 'false') v = false;
                            else if (!isNaN(Number(v)) && v !== '') v = Number(v);
                            handleChange('value', v);
                        }}
                        placeholder="true"
                        style={inputStyle}
                    />
                </div>
            </div>

            <div style={{ borderTop: '1px solid #333', paddingTop: '12px', marginTop: '4px' }}>
                <label style={{ ...labelStyle, color: '#4ec9b0' }}>Branches</label>

                <button onClick={() => pushScope(index, 'then')} style={btnStyle}>
                    <span>Edit "THEN" Block ({node.then?.length || 0} cmds)</span>
                    <ArrowRight size={14 * uiScale} />
                </button>

                <button onClick={() => pushScope(index, 'else')} style={btnStyle}>
                    <span>Edit "ELSE" Block ({node.else?.length || 0} cmds)</span>
                    <ArrowRight size={14 * uiScale} />
                </button>
            </div>
        </div>
    );
}