import type { SpriteCommand } from 'core';

import { useInspectorFieldEditor } from '../../hooks/useInspectorFieldEditor';
import { useProjectStore } from '../../store/useProjectStore';
import { FieldError } from './FieldError';

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
    value && typeof value === 'object' ? (value as Record<string, unknown>) : undefined;

export function SpriteInspector({ index, node }: { index?: null | number; node: SpriteCommand, }) {
    const { characters } = useProjectStore();
    const { getFieldErrors, getFieldInputStyle, handleChange, labelStyle } = useInspectorFieldEditor(index);

    const characterData = node.id ? asRecord(characters[node.id]) : undefined;
    const poses = asRecord(characterData?.poses);
    const animations = asRecord(characterData?.animations);
    const poseNames = poses ? Object.keys(poses) : [];
    const animationNames = animations ? Object.keys(animations) : [];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
                <label style={labelStyle}>Character ID</label>
                <input
                    list="character-ids"
                    onChange={(event) => handleChange('id', event.target.value)}
                    placeholder="e.g. phoenix"
                    style={getFieldInputStyle('id')}
                    type="text"
                    value={node.id || ''}
                />
                <FieldError errors={getFieldErrors('id')} />
                <datalist id="character-ids">
                    {Object.keys(characters).map((key) => <option key={key} value={key} />)}
                </datalist>
            </div>

            {characterData ? (
                <>
                    <div>
                        <label style={labelStyle}>Action</label>
                        <select
                            onChange={(event) => handleChange('action', event.target.value)}
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

                    {(node.action === 'show' || node.action === 'pose') && poses && (
                        <div>
                            <label style={labelStyle}>Pose</label>
                            <select
                                onChange={(event) => handleChange('pose', event.target.value)}
                                style={getFieldInputStyle('pose')}
                                value={node.pose || poseNames[0] || ''}
                            >
                                {poseNames.map((poseName) => <option key={poseName} value={poseName}>{poseName}</option>)}
                            </select>
                            <FieldError errors={getFieldErrors('pose')} />
                        </div>
                    )}

                    {node.action === 'animate' && animations && (
                        <div>
                            <label style={labelStyle}>Animation</label>
                            <select
                                onChange={(event) => handleChange('animation', event.target.value)}
                                style={getFieldInputStyle('animation')}
                                value={node.animation || animationNames[0] || ''}
                            >
                                {animationNames.map((animationName) => <option key={animationName} value={animationName}>{animationName}</option>)}
                            </select>
                            <FieldError errors={getFieldErrors('animation')} />
                        </div>
                    )}

                    {(node.action === 'show' || node.action === 'pose' || node.action === 'animate') && (
                        <div>
                            <label style={labelStyle}>Asset Override Util</label>
                            <input
                                onChange={(event) => handleChange('assetUrl', event.target.value)}
                                placeholder="(auto-resolved)"
                                style={getFieldInputStyle('assetUrl')}
                                type="text"
                                value={node.assetUrl ?? ''}
                            />
                            <div style={{ color: '#666', fontSize: '0.8em', fontStyle: 'italic', marginTop: '2px' }}>
                                Optional: Override resolved asset.
                            </div>
                        </div>
                    )}

                    <div>
                        <label style={labelStyle}>X Position (Left)</label>
                        <input
                            onChange={(event) => handleChange('x', Number(event.target.value))}
                            style={getFieldInputStyle('x')}
                            type="number"
                            value={node.x ?? ''}
                        />
                        <FieldError errors={getFieldErrors('x')} />
                    </div>

                    <div>
                        <label style={labelStyle}>Y Position (Top)</label>
                        <input
                            onChange={(event) => handleChange('y', Number(event.target.value))}
                            style={getFieldInputStyle('y')}
                            type="number"
                            value={node.y ?? ''}
                        />
                        <FieldError errors={getFieldErrors('y')} />
                    </div>
                </>
            ) : (
                <div style={{ color: '#888', fontStyle: 'italic' }}> Character definition not found. </div>
            )}
        </div>
    );
}