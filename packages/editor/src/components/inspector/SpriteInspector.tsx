import { useProjectStore } from '../../store/useProjectStore';
import { useInspectorFieldEditor } from './useInspectorFieldEditor';
import { FieldError } from './FieldError';

export function SpriteInspector({ node, index }: { node: any, index?: number | null }) {
    const { characters } = useProjectStore();
    const { handleChange, labelStyle, getFieldErrors, getFieldInputStyle } = useInspectorFieldEditor(index);

    const characterData = node.id ? characters[node.id] : null;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
                <label style={labelStyle}>Character ID</label>
                <input
                    type="text"
                    value={node.id || ''}
                    onChange={e => handleChange('id', e.target.value)}
                    list="character-ids"
                    placeholder="e.g. phoenix"
                    style={getFieldInputStyle('id')}
                />
                <FieldError errors={getFieldErrors('id')} />
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
                            style={getFieldInputStyle('action')}
                        >
                            <option value="show">Show</option>
                            <option value="hide">Hide</option>
                            <option value="animate">Animate</option>
                            <option value="pose">Set Pose</option>
                        </select>
                        <FieldError errors={getFieldErrors('action')} />
                    </div>

                    {(node.action === 'show' || node.action === 'pose') && characterData.poses && (
                        <div>
                            <label style={labelStyle}>Pose</label>
                            <select
                                value={node.pose || 'default'}
                                onChange={e => handleChange('pose', e.target.value)}
                                style={getFieldInputStyle('pose')}
                            >
                                <option value="">(Select Pose)</option>
                                {Object.keys(characterData.poses).map(p => <option key={p} value={p}>{p}</option>)}
                            </select>
                            <FieldError errors={getFieldErrors('pose')} />
                        </div>
                    )}

                    {node.action === 'animate' && characterData.animations && (
                        <div>
                            <label style={labelStyle}>Animation</label>
                            <select
                                value={node.animation || ''}
                                onChange={e => handleChange('animation', e.target.value)}
                                style={getFieldInputStyle('animation')}
                            >
                                <option value="">(Select Animation)</option>
                                {Object.keys(characterData.animations).map(a => <option key={a} value={a}>{a}</option>)}
                            </select>
                            <FieldError errors={getFieldErrors('animation')} />
                        </div>
                    )}
                </>
            ) : (
                <div>
                    <label style={labelStyle}>Asset URL</label>
                    <input
                        type="text"
                        value={node.assetUrl || ''}
                        onChange={e => handleChange('assetUrl', e.target.value)}
                        style={getFieldInputStyle('assetUrl')}
                    />
                    <FieldError errors={getFieldErrors('assetUrl')} />
                </div>
            )}

            <div style={{ display: 'flex', gap: '8px' }}>
                <div style={{ flex: 1 }}>
                    <label style={labelStyle}>X</label>
                    <input
                        type="number"
                        value={node.x ?? ''}
                        onChange={e => handleChange('x', parseFloat(e.target.value))}
                        style={getFieldInputStyle('x')}
                        placeholder="Default"
                    />
                    <FieldError errors={getFieldErrors('x')} />
                </div>
                <div style={{ flex: 1 }}>
                    <label style={labelStyle}>Y</label>
                    <input
                        type="number"
                        value={node.y ?? ''}
                        onChange={e => handleChange('y', parseFloat(e.target.value))}
                        style={getFieldInputStyle('y')}
                        placeholder="Default"
                    />
                    <FieldError errors={getFieldErrors('y')} />
                </div>
            </div>
        </div>
    );
}