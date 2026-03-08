import type { ForCommand } from 'core';

import { useInspectorFieldEditor } from '../../hooks/useInspectorFieldEditor';
import { FieldError } from './FieldError';

export function ForInspector({ index, node }: { index?: null | number; node: ForCommand; }) {
    const { getFieldErrors, getFieldInputStyle, handleChange, labelStyle } = useInspectorFieldEditor(index);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
                <label style={labelStyle}>Iterator Variable</label>
                <input
                    onChange={(event) => handleChange('iterator', event.target.value)}
                    style={getFieldInputStyle('iterator')}
                    type="text"
                    value={node.iterator || ''}
                />
                <FieldError errors={getFieldErrors('iterator')} />
            </div>

            <div>
                <label style={labelStyle}>Start (From)</label>
                <input
                    onChange={(event) => handleChange('from', event.target.value ? Number(event.target.value) : '')}
                    style={getFieldInputStyle('from')}
                    type="number"
                    value={node.from ?? ''}
                />
                <FieldError errors={getFieldErrors('from')} />
            </div>

            <div>
                <label style={labelStyle}>End (To)</label>
                <input
                    onChange={(event) => handleChange('to', event.target.value ? Number(event.target.value) : '')}
                    style={getFieldInputStyle('to')}
                    type="number"
                    value={node.to ?? ''}
                />
                <FieldError errors={getFieldErrors('to')} />
            </div>

            <div>
                <label style={labelStyle}>Step</label>
                <input
                    onChange={(event) => handleChange('step', event.target.value ? Number(event.target.value) : '')}
                    style={getFieldInputStyle('step')}
                    type="number"
                    value={node.step ?? 1}
                />
                <FieldError errors={getFieldErrors('step')} />
            </div>
        </div>
    );
}