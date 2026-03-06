import { useProjectStore } from '../../store/useProjectStore';
import { DialogueInspector } from './DialogueInspector';
import { SpriteInspector } from './SpriteInspector';
import { MacroInspector } from './MacroInspector';
import { IfInspector } from './IfInspector';

export function Inspector() {
    const script = useProjectStore(state => state.script);
    const selectedNodeIndex = useProjectStore(state => state.selectedNodeIndex);
    const updateScript = useProjectStore(state => state.updateScript);
    const uiScale = useProjectStore(state => state.uiScale);

    if (selectedNodeIndex === null || !script[selectedNodeIndex]) {
        return <p style={{ fontSize: 'inherit', color: '#666', fontStyle: 'italic', textAlign: 'center', marginTop: '20px' }}>Select a node to edit.</p>;
    }

    const node = script[selectedNodeIndex];

    const handleChange = (field: string, value: any) => {
        const newScript = script.map((n, i) => i === selectedNodeIndex ? { ...n, [field]: value } : n);
        updateScript(newScript);
    };

    const inputStyle = { width: '100%', padding: `${8 * uiScale}px`, backgroundColor: '#1e1e1e', border: '1px solid #3c3c3c', color: '#fff', borderRadius: '4px', fontSize: 'inherit', outline: 'none' };
    const labelStyle = { display: 'block', marginBottom: `${6 * uiScale}px`, color: '#888', fontSize: '0.85em' };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: `${16 * uiScale}px`, fontSize: 'inherit' }}>
            <div style={{ paddingBottom: '8px', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#666', fontSize: '0.85em', fontWeight: 'bold' }}>NODE TYPE</span>
                <span style={{ color: '#aaa', fontSize: '0.85em', fontWeight: 'bold', textTransform: 'uppercase' }}>{node.type}</span>
            </div>

            {node.type === 'dialogue' && <DialogueInspector node={node} index={selectedNodeIndex} />}
            {node.type === 'sprite' && <SpriteInspector node={node} index={selectedNodeIndex} />}
            {node.type === 'call' && <MacroInspector node={node} index={selectedNodeIndex} />}
            {node.type === 'if' && <IfInspector node={node} index={selectedNodeIndex} />}

            {(node.type === 'background' || node.type === 'bgm') && (
                <div>
                    <label style={labelStyle}>Asset URL</label>
                    <input type="text" value={node.assetUrl || ''} onChange={e => handleChange('assetUrl', e.target.value)} style={inputStyle} />
                </div>
            )}
        </div>
    );
}