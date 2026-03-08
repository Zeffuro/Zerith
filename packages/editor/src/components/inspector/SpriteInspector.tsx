import { useInspectorFieldEditor } from '../../hooks/useInspectorFieldEditor';
import { useProjectStore } from '../../store/useProjectStore';
import { FieldError } from './FieldError';

export function SpriteInspector({ index, node }: { index?: null | number; node: any, }) {
    const { characters } = useProjectStore();
    const { getFieldErrors, getFieldInputStyle, handleChange, labelStyle } = useInspectorFieldEditor(index);

    const characterData = node.id ? characters[node.id] : null;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
                <label style={labelStyle}>Character ID</label>
                <input
                    list="character-ids"
                    onChange={e => handleChange('id', e.target.value)}
                    placeholder="e.g. phoenix"
                    style={getFieldInputStyle('id')}
                    type="text"
                    value={node.id || ''}
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
                            onChange={e => handleChange('action', e.target.value)}
                            style={getFieldInputStyle('action')}
                            value={node.action || 'show'}
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
                                onChange={e => handleChange('pose', e.target.value)}
                                style={getFieldInputStyle('pose')}
                                value={node.pose || 'default'}
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
                                onChange={e => handleChange('animation', e.target.value)}
                                style={getFieldInputStyle('animation')}
                                value={node.animation || ''}
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
                        onChange={e => handleChange('assetUrl', e.target.value)}
                        style={getFieldInputStyle('assetUrl')}
                        type="text"
                        value={node.assetUrl || ''}
                    />
                    <FieldError errors={getFieldErrors('assetUrl')} />
                </div>
            )}

            <div style={{ display: 'flex', gap: '8px' }}>
                <div style={{ flex: 1 }}>
                    <label style={labelStyle}>X</label>
                    <input
                        onChange={e => handleChange('x', Number.parseFloat(e.target.value))}
                        placeholder="Default"
                        style={getFieldInputStyle('x')}
                        type="number"
                        value={node.x ?? ''}
                    />
                    <FieldError errors={getFieldErrors('x')} />
                </div>
                <div style={{ flex: 1 }}>
                    <label style={labelStyle}>Y</label>
                    <input
                        onChange={e => handleChange('y', Number.parseFloat(e.target.value))}
                        placeholder="Default"
                        style={getFieldInputStyle('y')}
                        type="number"
                        value={node.y ?? ''}
                    />
                    <FieldError errors={getFieldErrors('y')} />
                </div>
            </div>
        </div>
    );
}