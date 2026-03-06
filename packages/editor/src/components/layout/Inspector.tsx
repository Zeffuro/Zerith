import { useProjectStore } from '../../store/useProjectStore';

export function Inspector() {
    const script = useProjectStore(state => state.script);
    const selectedNodeIndex = useProjectStore(state => state.selectedNodeIndex);
    const updateScript = useProjectStore(state => state.updateScript);

    if (selectedNodeIndex === null || !script[selectedNodeIndex]) {
        return <p style={{ fontSize: '13px', color: '#aaa' }}>Select a node in the timeline to edit its properties here.</p>;
    }

    const node = script[selectedNodeIndex];

    const handleChange = (field: string, value: string) => {
        const newScript = script.map((node, i) =>
            i === selectedNodeIndex ? { ...node, [field]: value } : node
        );
        updateScript(newScript);
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px' }}>
            <div>
                <label style={{ display: 'block', marginBottom: '4px', color: '#888' }}>Type</label>
                <input
                    type="text" disabled value={node.type}
                    style={{ width: '100%', padding: '6px', backgroundColor: '#111', border: '1px solid #333', color: '#888', borderRadius: '4px' }}
                />
            </div>

            {node.type === 'dialogue' && (
                <>
                    <div>
                        <label style={{ display: 'block', marginBottom: '4px', color: '#888' }}>Speaker</label>
                        <input
                            type="text" value={node.speaker || ''}
                            onChange={e => handleChange('speaker', e.target.value)}
                            style={{ width: '100%', padding: '6px', backgroundColor: '#1e1e1e', border: '1px solid #3c3c3c', color: '#fff', borderRadius: '4px' }}
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: '4px', color: '#888' }}>Text</label>
                        <textarea
                            value={node.text || ''}
                            onChange={e => handleChange('text', e.target.value)} rows={4}
                            style={{ width: '100%', padding: '6px', backgroundColor: '#1e1e1e', border: '1px solid #3c3c3c', color: '#fff', borderRadius: '4px', resize: 'vertical' }}
                        />
                    </div>
                </>
            )}

            {node.type === 'background' && (
                <div>
                    <label style={{ display: 'block', marginBottom: '4px', color: '#888' }}>Asset URL</label>
                    <input
                        type="text" value={node.assetUrl || ''}
                        onChange={e => handleChange('assetUrl', e.target.value)}
                        style={{ width: '100%', padding: '6px', backgroundColor: '#1e1e1e', border: '1px solid #3c3c3c', color: '#fff', borderRadius: '4px' }}
                    />
                </div>
            )}
        </div>
    );
}