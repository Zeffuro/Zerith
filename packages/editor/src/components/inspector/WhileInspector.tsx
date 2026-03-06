import { ArrowRight } from 'lucide-react';
import { useScriptStore } from '../../store/useScriptStore';
import { useInspectorFieldEditor } from './useInspectorFieldEditor';

export function WhileInspector({ node, index }: { node: any; index?: number | null }) {
    const { pushScope } = useScriptStore();
    const { uiScale, handleChange, labelStyle, inputStyle } = useInspectorFieldEditor(index);

    const btnStyle = {
        width: '100%',
        padding: `${8 * uiScale}px`,
        backgroundColor: '#333',
        border: 'none',
        color: '#fff',
        borderRadius: '4px',
        cursor: 'pointer',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: '8px',
    } as const;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: `${12 * uiScale}px` }}>
            <div>
                <label style={labelStyle}>Condition Source</label>
                <select
                    value={node.source || 'variable'}
                    onChange={(e) => handleChange('source', e.target.value)}
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
                    onChange={(e) => handleChange('key', e.target.value)}
                    placeholder="e.g. focus"
                    style={inputStyle}
                />
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
                <div style={{ flex: 1 }}>
                    <label style={labelStyle}>Operator</label>
                    <select
                        value={node.op || 'eq'}
                        onChange={(e) => handleChange('op', e.target.value)}
                        style={inputStyle}
                    >
                        <option value="eq">==</option>
                        <option value="neq">!=</option>
                        <option value="gt">&gt;</option>
                        <option value="gte">&gt;=</option>
                        <option value="lt">&lt;</option>
                        <option value="lte">&lt;=</option>
                    </select>
                </div>
                <div style={{ flex: 1 }}>
                    <label style={labelStyle}>Value</label>
                    <input
                        type="text"
                        value={node.value !== undefined ? String(node.value) : ''}
                        onChange={(e) => {
                            let v: any = e.target.value;
                            if (v === 'true') v = true;
                            else if (v === 'false') v = false;
                            else if (v !== '' && !isNaN(Number(v))) v = Number(v);
                            handleChange('value', v);
                        }}
                        placeholder="true / 3 / text"
                        style={inputStyle}
                    />
                </div>
            </div>

            <div>
                <label style={labelStyle}>Max Iterations (safety)</label>
                <input
                    type="number"
                    min={1}
                    value={node.maxIterations ?? 10000}
                    onChange={(e) => handleChange('maxIterations', Number(e.target.value))}
                    style={inputStyle}
                />
            </div>

            <div style={{ borderTop: '1px solid #333', paddingTop: '12px' }}>
                <label style={{ ...labelStyle, color: '#4ec9b0' }}>Branch</label>
                <button
                    onClick={() => index !== null && index !== undefined && pushScope(index, 'body')}
                    style={btnStyle}
                >
                    <span>Edit "BODY" Block ({node.body?.length || 0} cmds)</span>
                    <ArrowRight size={14 * uiScale} />
                </button>
            </div>
        </div>
    );
}