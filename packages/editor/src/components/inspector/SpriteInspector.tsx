import type { SpriteCommand } from '@zeffuro/zerith-core';

import { useInspectorFieldEditor } from '../../hooks/useInspectorFieldEditor';
import { useProjectStore } from '../../store/storeBootstrap';
import { editorTheme as t } from '../../theme/editorTheme';
import { toRecordOrUndefined } from '../../utils/typeGuards';
import { FieldError } from './FieldError';

type SpriteCommandField = Extract<keyof SpriteCommand, string>;

export function SpriteInspector({ index, node }: { index?: null | number; node: SpriteCommand, }) {
    const { characters } = useProjectStore();
    const { getFieldErrors, getFieldInputStyle, handleChange, labelStyle } = useInspectorFieldEditor(index);

    const characterData = node.id ? toRecordOrUndefined(characters[node.id]) : undefined;
    const poses = toRecordOrUndefined(characterData?.poses);
    const animations = toRecordOrUndefined(characterData?.animations);
    const poseNames = poses ? Object.keys(poses) : [];
    const animationNames = animations ? Object.keys(animations) : [];
    const handleOptionalNumberChange = (field: SpriteCommandField, value: string) => {
        handleChange(field, value.trim().length === 0 ? undefined : Number(value));
    };
    const handleOptionalPercentChange = (field: SpriteCommandField, value: string) => {
        handleChange(field, value.trim().length === 0 ? undefined : Number(value) / 100);
    };
    const handleOptionalStringChange = (field: SpriteCommandField, value: string) => {
        handleChange(field, value.length === 0 ? undefined : value);
    };
    const toPercentInputValue = (value: number | undefined) =>
        value === undefined ? '' : Number((value * 100).toFixed(4));

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
                            <option value="move">Move</option>
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

                    {(['animate', 'pose', 'show'] as readonly string[]).includes(node.action) && (
                        <div>
                            <label style={labelStyle}>Asset Override Util</label>
                            <input
                                onChange={(event) => handleChange('assetUrl', event.target.value)}
                                placeholder="(auto-resolved)"
                                style={getFieldInputStyle('assetUrl')}
                                type="text"
                                value={node.assetUrl ?? ''}
                            />
                            <div style={{ color: t.text.muted, fontSize: '0.8em', fontStyle: 'italic', marginTop: '2px' }}>
                                Optional: Override resolved asset.
                            </div>
                        </div>
                    )}

                    {(['move', 'show'] as readonly string[]).includes(node.action) && (
                        <>
                            <div>
                                <label style={labelStyle}>X Position</label>
                                <input
                                    onChange={(event) => handleOptionalNumberChange('x', event.target.value)}
                                    style={getFieldInputStyle('x')}
                                    type="number"
                                    value={node.x ?? ''}
                                />
                                <FieldError errors={getFieldErrors('x')} />
                            </div>

                            <div>
                                <label style={labelStyle}>Y Position</label>
                                <input
                                    onChange={(event) => handleOptionalNumberChange('y', event.target.value)}
                                    style={getFieldInputStyle('y')}
                                    type="number"
                                    value={node.y ?? ''}
                                />
                                <FieldError errors={getFieldErrors('y')} />
                            </div>

                            <div>
                                <label style={labelStyle}>X % of Stage</label>
                                <input
                                    max={100}
                                    min={0}
                                    onChange={(event) => handleOptionalPercentChange('xRatio', event.target.value)}
                                    step={0.01}
                                    style={getFieldInputStyle('xRatio')}
                                    type="number"
                                    value={toPercentInputValue(node.xRatio)}
                                />
                                <FieldError errors={getFieldErrors('xRatio')} />
                            </div>

                            <div>
                                <label style={labelStyle}>Y % of Stage</label>
                                <input
                                    max={100}
                                    min={0}
                                    onChange={(event) => handleOptionalPercentChange('yRatio', event.target.value)}
                                    step={0.01}
                                    style={getFieldInputStyle('yRatio')}
                                    type="number"
                                    value={toPercentInputValue(node.yRatio)}
                                />
                                <FieldError errors={getFieldErrors('yRatio')} />
                            </div>
                        </>
                    )}

                    {node.action === 'show' && (
                        <>
                            <div>
                                <label style={labelStyle}>Scale X</label>
                                <input
                                    onChange={(event) => handleOptionalNumberChange('scaleX', event.target.value)}
                                    step={0.01}
                                    style={getFieldInputStyle('scaleX')}
                                    type="number"
                                    value={node.scaleX ?? ''}
                                />
                                <FieldError errors={getFieldErrors('scaleX')} />
                            </div>

                            <div>
                                <label style={labelStyle}>Scale Y</label>
                                <input
                                    onChange={(event) => handleOptionalNumberChange('scaleY', event.target.value)}
                                    step={0.01}
                                    style={getFieldInputStyle('scaleY')}
                                    type="number"
                                    value={node.scaleY ?? ''}
                                />
                                <FieldError errors={getFieldErrors('scaleY')} />
                            </div>

                            <div>
                                <label style={labelStyle}>Width % of Stage</label>
                                <input
                                    max={100}
                                    min={0}
                                    onChange={(event) => handleOptionalPercentChange('widthRatio', event.target.value)}
                                    step={0.01}
                                    style={getFieldInputStyle('widthRatio')}
                                    type="number"
                                    value={toPercentInputValue(node.widthRatio)}
                                />
                                <FieldError errors={getFieldErrors('widthRatio')} />
                            </div>

                            <div>
                                <label style={labelStyle}>Height % of Stage</label>
                                <input
                                    max={100}
                                    min={0}
                                    onChange={(event) => handleOptionalPercentChange('heightRatio', event.target.value)}
                                    step={0.01}
                                    style={getFieldInputStyle('heightRatio')}
                                    type="number"
                                    value={toPercentInputValue(node.heightRatio)}
                                />
                                <FieldError errors={getFieldErrors('heightRatio')} />
                            </div>

                            <div>
                                <label style={labelStyle}>Fit Mode</label>
                                <select
                                    onChange={(event) => handleOptionalStringChange('fit', event.target.value)}
                                    style={getFieldInputStyle('fit')}
                                    value={node.fit ?? ''}
                                >
                                    <option value="">Default</option>
                                    <option value="contain">Contain</option>
                                    <option value="cover">Cover</option>
                                    <option value="stretch">Stretch</option>
                                </select>
                                <FieldError errors={getFieldErrors('fit')} />
                            </div>
                        </>
                    )}
                </>
            ) : (
                <div style={{ color: t.text.faint, fontStyle: 'italic' }}> Character definition not found. </div>
            )}
        </div>
    );
}
