import { useProjectStore } from '../../store/useProjectStore';
import { MessageSquare, Image as ImageIcon, Code, Plus, Trash2 } from 'lucide-react';

export function Timeline() {
    const { script, updateScript, selectedNodeIndex, setSelectedNode } = useProjectStore();

    const getIcon = (type: string) => {
        if (type === 'dialogue') return <MessageSquare size={14} color="#60a5fa" />;
        if (type === 'background' || type === 'sprite') return <ImageIcon size={14} color="#34d399" />;
        return <Code size={14} color="#a78bfa" />;
    };

    const addNode = () => {
        const newNode = { type: 'dialogue', speaker: 'New Speaker', text: 'New text...' };
        const index = selectedNodeIndex !== null ? selectedNodeIndex + 1 : script.length;
        const newScript = [...script];
        newScript.splice(index, 0, newNode);
        updateScript(newScript);
        setSelectedNode(index);
    };

    const deleteNode = () => {
        if (selectedNodeIndex === null) return;
        const newScript = script.filter((_, i) => i !== selectedNodeIndex);
        updateScript(newScript);
        setSelectedNode(null);
    };

    return (
        <div style={{ padding: '12px', height: '100%', backgroundColor: '#1e1e1e', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                <div style={{ color: '#fff', fontSize: '12px', fontWeight: 'bold' }}>SCRIPT TIMELINE</div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={addNode} title="Add Node"><Plus size={16} /></button>
                    <button onClick={deleteNode} title="Delete Node"><Trash2 size={16} color="#f87171" /></button>
                </div>
            </div>
            <div style={{ flexGrow: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {script.map((node, i) => (
                    <div
                        key={i}
                        onClick={() => setSelectedNode(i)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '8px 12px',
                            backgroundColor: selectedNodeIndex === i ? '#04395e' : '#252526',
                            border: `1px solid ${selectedNodeIndex === i ? '#007fd4' : '#333'}`,
                            borderRadius: '4px',
                            cursor: 'pointer',
                            color: '#ccc',
                            fontSize: '13px'
                        }}
                    >
                        {getIcon(node.type)}
                        <strong style={{ minWidth: '80px', color: '#fff' }}>{node.type}</strong>

                        <span style={{ color: '#888', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {node.type === 'dialogue' && `${node.speaker}: "${node.text}"`}
                            {node.type === 'background' && node.assetUrl}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}