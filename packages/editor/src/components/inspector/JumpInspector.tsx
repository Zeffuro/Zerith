import type { JumpCommand } from 'zerith-core';

import { useInspectorFieldEditor } from '../../hooks/useInspectorFieldEditor';
import { useProjectStore } from '../../store/storeBootstrap';
import { FieldError } from './FieldError';

export function JumpInspector({ index, node }: { index?: null | number; node: JumpCommand; }) {
    const { getFieldErrors, getFieldInputStyle, handleChange, labelStyle } = useInspectorFieldEditor(index);
    const sceneNames = Object.keys(useProjectStore((state) => state.scenes));

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
                <label style={labelStyle}>Target Scene</label>
                <input
                    list="jump-scene-ids"
                    onChange={(event) => handleChange('to', event.target.value)}
                    placeholder="e.g. intro_courtroom"
                    style={getFieldInputStyle('to')}
                    type="text"
                    value={node.to || ''}
                />
                <FieldError errors={getFieldErrors('to')} />
                <datalist id="jump-scene-ids">
                    {sceneNames.map((sceneName) => <option key={sceneName} value={sceneName} />)}
                </datalist>
            </div>
        </div>
    );
}