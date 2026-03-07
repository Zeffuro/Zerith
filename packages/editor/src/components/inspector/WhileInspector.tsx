import { useInspectorFieldEditor } from './useInspectorFieldEditor';
import { FieldError } from './FieldError';

export function WhileInspector({ node, index }: { node: any; index?: number | null }) {
    const { uiScale, handleChange, labelStyle, getFieldErrors, getFieldInputStyle } = useInspectorFieldEditor(index);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: `${12 * uiScale}px` }}>
            <div>
                <label style={labelStyle}>Condition Source</label>
                <select
                    value={node.source || 'variable'}
                    onChange={(e) => handleChange('source', e.target.value)}
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
                    onChange={(e) => handleChange('key', e.target.value)}
                    placeholder="e.g. focus"
                    style={getFieldInputStyle('key')}
                />
                <FieldError errors={getFieldErrors('key')} />
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
                <div style={{ flex: 1 }}>
                    <label style={labelStyle}>Operator</label>
                    <select
                        value={node.op || 'eq'}
                        onChange={(e) => handleChange('op', e.target.value)}
                        style={getFieldInputStyle('op')}
                    >
                        <option value="eq">==</option>
                        <option value="neq">!=</option>
                        <option value="gt">&gt;</option>
                        <option value="gte">&gt;=</option>
                        <option value="lt">&lt;</option>
                        <option value="lte">&lt;=</option>
                    </select>
                    <FieldError errors={getFieldErrors('op')} />
                </div>
                <div style={{ flex: 1 }}>
                    <label style={labelStyle}>Value</label>
                    <input
                        type="text"
                        value={node.value !== undefined ? String(node.value) : ''}
                        onChange={(e) => {
                            let v: any = e.target.value;
                            if (v === 'true') v = true;
                            else if (v === 'false') v = false;
                            else if (v !== '' && !isNaN(Number(v))) v = Number(v);
                            handleChange('value', v);
                        }}
                        placeholder="true / 3 / text"
                        style={getFieldInputStyle('value')}
                    />
                    <FieldError errors={getFieldErrors('value')} />
                </div>
            </div>

            <div>
                <label style={labelStyle}>Max Iterations (safety)</label>
                <input
                    type="number"
                    min={1}
                    value={node.maxIterations ?? 10000}
                    onChange={(e) => handleChange('maxIterations', Number(e.target.value))}
                    style={getFieldInputStyle('maxIterations')}
                />
                <FieldError errors={getFieldErrors('maxIterations')} />
            </div>
        </div>
    );
}