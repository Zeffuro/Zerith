import { useEditorStore } from '../../store/useEditorStore';
import { useScriptStore } from '../../store/useScriptStore';
import { getPlugin } from '../../editor/commandPlugins';

export function Inspector() {
    const uiScale = useEditorStore(state => state.uiScale);
    const {
        getActiveScript,
        selectedNodeIndex,
        selectedNodePath,
        getNodeAtPath,
        updateActiveScript,
        updateNodeAtPath
    } = useScriptStore();

    const script = getActiveScript();

    let node: any = null;
    if (selectedNodePath) {
        node = getNodeAtPath(selectedNodePath);
    } else if (selectedNodeIndex !== null && script[selectedNodeIndex]) {
        node = script[selectedNodeIndex];
    }

    if (!node) {
        return (
            <p
                style={{
                    fontSize: 'inherit',
                    color: '#666',
                    fontStyle: 'italic',
                    textAlign: 'center',
                    marginTop: '20px'
                }}
            >
                Select a node to edit.
            </p>
        );
    }

    const handleChange = (field: string, value: any) => {
        if (selectedNodePath) {
            updateNodeAtPath(selectedNodePath, { [field]: value });
            return;
        }
        if (selectedNodeIndex === null) return;
        const newScript = script.map((n, i) => (i === selectedNodeIndex ? { ...n, [field]: value } : n));
        updateActiveScript(newScript);
    };

    const inputStyle = {
        width: '100%',
        padding: `${8 * uiScale}px`,
        backgroundColor: '#1e1e1e',
        border: '1px solid #3c3c3c',
        color: '#fff',
        borderRadius: '4px',
        fontSize: 'inherit',
        outline: 'none'
    };

    const labelStyle = {
        display: 'block',
        marginBottom: `${6 * uiScale}px`,
        color: '#888',
        fontSize: '0.85em'
    };

    const plugin = getPlugin(node.type);
    const PluginInspector = plugin.Inspector;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: `${16 * uiScale}px`, fontSize: 'inherit' }}>
            <div
                style={{
                    paddingBottom: '8px',
                    borderBottom: '1px solid #333',
                    display: 'flex',
                    justifyContent: 'space-between'
                }}
            >
                <span style={{ color: '#666', fontSize: '0.85em', fontWeight: 'bold' }}>NODE TYPE</span>
                <span
                    style={{
                        color: '#aaa',
                        fontSize: '0.85em',
                        fontWeight: 'bold',
                        textTransform: 'uppercase'
                    }}
                >
                    {node.type}
                </span>
            </div>

            {PluginInspector ? (
                <PluginInspector node={node} index={selectedNodeIndex} />
            ) : (
                <div style={{ color: '#777', fontStyle: 'italic' }}>
                    No custom inspector for "{node.type}" yet.
                </div>
            )}

            {(node.type === 'background' || node.type === 'bgm') && (
                <div>
                    <label style={labelStyle}>Asset URL</label>
                    <input
                        type="text"
                        value={node.assetUrl || ''}
                        onChange={e => handleChange('assetUrl', e.target.value)}
                        style={inputStyle}
                    />
                </div>
            )}
        </div>
    );
}