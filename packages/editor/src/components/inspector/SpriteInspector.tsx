import { useProjectStore } from '../../store/useProjectStore';
import { useScriptStore } from '../../store/useScriptStore';
import { useEditorStore } from '../../store/useEditorStore';

export function SpriteInspector({ node, index }: { node: any, index: number }) {
    const { getActiveScript, updateActiveScript } = useScriptStore();
    const { characters } = useProjectStore();
    const { uiScale } = useEditorStore();

    const handleChange = (field: string, value: any) => {
        const script = getActiveScript();
        const newScript = script.map((n, i) => i === index ? { ...n, [field]: value } : n);
        updateActiveScript(newScript);
    };

    const characterData = node.id ? characters[node.id] : null;

    const labelStyle = { display: 'block', marginBottom: `${6 * uiScale}px`, color: '#888', fontSize: '0.85em' };
    const inputStyle = { width: '100%', padding: `${8 * uiScale}px`, backgroundColor: '#1e1e1e', border: '1px solid #3c3c3c', color: '#fff', borderRadius: '4px', fontSize: 'inherit', outline: 'none' };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
                <label style={labelStyle}>Character ID</label>
                <input
                    type="text" value={node.id || ''}
                    onChange={e => handleChange('id', e.target.value)}
                    list="character-ids"
                    placeholder="e.g. phoenix"
                    style={inputStyle}
                />
                <datalist id="character-ids">
                    {Object.keys(characters).map(key => <option key={key} value={key} />)}
                </datalist>
            </div>

            {characterData ? (
                <>
                    <div>
                        <label style={labelStyle}>Action</label>
                        <select
                            value={node.action || 'show'}
                            onChange={e => handleChange('action', e.target.value)}
                            style={inputStyle}
                        >
                            <option value="show">Show</option>
                            <option value="hide">Hide</option>
                            <option value="animate">Animate</option>
                            <option value="pose">Set Pose</option>
                        </select>
                    </div>

                    {(node.action === 'show' || node.action === 'pose') && characterData.poses && (
                        <div>
                            <label style={labelStyle}>Pose</label>
                            <select
                                value={node.pose || 'default'}
                                onChange={e => handleChange('pose', e.target.value)}
                                style={inputStyle}
                            >
                                <option value="">(Select Pose)</option>
                                {Object.keys(characterData.poses).map(p => <option key={p} value={p}>{p}</option>)}
                            </select>
                        </div>
                    )}

                    {node.action === 'animate' && characterData.animations && (
                        <div>
                            <label style={labelStyle}>Animation</label>
                            <select
                                value={node.animation || ''}
                                onChange={e => handleChange('animation', e.target.value)}
                                style={inputStyle}
                            >
                                <option value="">(Select Animation)</option>
                                {Object.keys(characterData.animations).map(a => <option key={a} value={a}>{a}</option>)}
                            </select>
                        </div>
                    )}
                </>
            ) : (
                <div>
                    <label style={labelStyle}>Asset URL</label>
                    <input
                        type="text" value={node.assetUrl || ''}
                        onChange={e => handleChange('assetUrl', e.target.value)}
                        style={inputStyle}
                    />
                </div>
            )}

            <div style={{ display: 'flex', gap: '8px' }}>
                <div style={{ flex: 1 }}>
                    <label style={labelStyle}>X</label>
                    <input type="number" value={node.x ?? ''} onChange={e => handleChange('x', parseFloat(e.target.value))} style={inputStyle} placeholder="Default" />
                </div>
                <div style={{ flex: 1 }}>
                    <label style={labelStyle}>Y</label>
                    <input type="number" value={node.y ?? ''} onChange={e => handleChange('y', parseFloat(e.target.value))} style={inputStyle} placeholder="Default" />
                </div>
            </div>
        </div>
    );
}