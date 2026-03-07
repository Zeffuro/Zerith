import { useInspectorFieldEditor } from './useInspectorFieldEditor';
import { FieldError } from './FieldError';

export function IfInspector({ node, index }: { node: any, index?: number | null }) {
    const { uiScale, handleChange, labelStyle, getFieldErrors, getFieldInputStyle } = useInspectorFieldEditor(index);


    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: `${12 * uiScale}px` }}>
            <div>
                <label style={labelStyle}>Condition Source</label>
                <select
                    value={node.source || 'variable'}
                    onChange={e => handleChange('source', e.target.value)}
                    style={getFieldInputStyle('source')}
                >
                    <option value="variable">Game Variable</option>
                    <option value="items">Items Inventory</option>
                </select>
                <FieldError errors={getFieldErrors('source')} />
            </div>

            <div>
                <label style={labelStyle}>Key / ID</label>
                <input
                    type="text"
                    value={node.key || ''}
                    onChange={e => handleChange('key', e.target.value)}
                    placeholder="e.g. has_met_bob"
                    style={getFieldInputStyle('key')}
                />
                <FieldError errors={getFieldErrors('key')} />
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
                <div style={{ flex: 1 }}>
                    <label style={labelStyle}>Operator</label>
                    <select value={node.op || 'eq'} onChange={e => handleChange('op', e.target.value)} style={getFieldInputStyle('op')}>
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
                        type="text"
                        value={node.value !== undefined ? node.value : ''}
                        onChange={e => {
                            let v: any = e.target.value;
                            if (v === 'true') v = true;
                            else if (v === 'false') v = false;
                            else if (!isNaN(Number(v)) && v !== '') v = Number(v);
                            handleChange('value', v);
                        }}
                        placeholder="true"
                        style={getFieldInputStyle('value')}
                    />
                    <FieldError errors={getFieldErrors('value')} />
                </div>
            </div>
        </div>
    );
}