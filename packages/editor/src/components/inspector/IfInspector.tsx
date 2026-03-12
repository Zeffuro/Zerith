import type { IfCommand } from 'core';

import { useMemo } from 'react';

import { useInspectorFieldEditor } from '../../hooks/useInspectorFieldEditor';
import { useProjectStore } from '../../store/useProjectStore';
import { FieldError } from './FieldError';
import { getEditableValue } from './utilities';

export function IfInspector({ index, node }: { index?: null | number; node: IfCommand, }) {
    const { getFieldErrors, getFieldInputStyle, handleChange, labelStyle, uiScale } = useInspectorFieldEditor(index);
    const manifestVariables = useProjectStore((state) => state.manifest?.variables);
    const variableKeys = useMemo(() => {
        if (!manifestVariables || typeof manifestVariables !== 'object' || Array.isArray(manifestVariables)) {
            return [];
        }
        return Object.keys(manifestVariables);
    }, [manifestVariables]);
    const listId = 'manifest-variable-keys';

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: `${12 * uiScale}px` }}>
            <div>
                <label style={labelStyle}>Condition Source</label>
                <select
                    onChange={(event) => handleChange('source', event.target.value)}
                    style={getFieldInputStyle('source')}
                    value={node.source || 'variable'}
                >
                    <option value="variable">Game Variable</option>
                    <option value="items">Items Inventory</option>
                </select>
                <FieldError errors={getFieldErrors('source')} />
            </div>

            <div>
                <label style={labelStyle}>Key / ID</label>
                <input
                    list={node.source === 'variable' ? listId : undefined}
                    onChange={(event) => handleChange('key', event.target.value)}
                    placeholder="e.g. has_met_bob"
                    style={getFieldInputStyle('key')}
                    type="text"
                    value={node.key || ''}
                />
                <datalist id={listId}>
                    {variableKeys.map((key) => (
                        <option key={key} value={key} />
                    ))}
                </datalist>
                <FieldError errors={getFieldErrors('key')} />
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
                <div style={{ flex: 1 }}>
                    <label style={labelStyle}>Operator</label>
                    <select onChange={(event) => handleChange('op', event.target.value)} style={getFieldInputStyle('op')} value={node.op || 'eq'}>
                        <option value="eq">== (Equal)</option>
                        <option value="neq">!= (Not Equal)</option>
                        <option value="gt">&gt; (Greater)</option>
                        <option value="lt">&lt; (Less)</option>
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
                        placeholder="true"
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

