import type { SetCommand } from 'core';

import { useInspectorFieldEditor } from '../../hooks/useInspectorFieldEditor';
import { FieldError } from './FieldError';
import { getEditableValue } from './utilities';

export function SetInspector({ index, node }: { index?: null | number; node: SetCommand; }) {
    const { getFieldErrors, getFieldInputStyle, handleChange, labelStyle } = useInspectorFieldEditor(index);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
                <label style={labelStyle}>Variable Key</label>
                <input
                    onChange={(event) => handleChange('key', event.target.value)}
                    placeholder="e.g. has_met_bob"
                    style={getFieldInputStyle('key')}
                    type="text"
                    value={node.key || ''}
                />
                <FieldError errors={getFieldErrors('key')} />
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
                <div style={{ flex: 1 }}>
                    <label style={labelStyle}>Operator</label>
                    <select
                        onChange={(event) => handleChange('op', event.target.value)}
                        style={getFieldInputStyle('op')}
                        value={node.op || 'set'}
                    >
                        <option value="set">=</option>
                        <option value="add">+</option>
                        <option value="sub">-</option>
                    </select>
                    <FieldError errors={getFieldErrors('op')} />
                </div>
                <div style={{ flex: 1 }}>
                    <label style={labelStyle}>Value</label>
                    <input
                        onChange={(event) => {
                            let value: boolean | number | string = event.target.value;
                            const numberValue = Number(value);
                            if (value === 'true') value = true;
                            else if (value === 'false') value = false;
                            else if (!Number.isNaN(numberValue) && value !== '') value = numberValue;
                            handleChange('value', value);
                        }}
                        style={getFieldInputStyle('value')}
                        type="text"
                        value={getEditableValue(node.value)}
                    />
                    <FieldError errors={getFieldErrors('value')} />
                </div>
            </div>
        </div>
    );
}

