import { useInspectorFieldEditor } from '../../hooks/useInspectorFieldEditor';
import { FieldError } from './FieldError';

export function WhileInspector({ index, node }: { index?: null | number; node: any; }) {
    const { getFieldErrors, getFieldInputStyle, handleChange, labelStyle, uiScale } = useInspectorFieldEditor(index);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: `${12 * uiScale}px` }}>
            <div>
                <label style={labelStyle}>Condition Source</label>
                <select
                    onChange={(e) => handleChange('source', e.target.value)}
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
                    onChange={(e) => handleChange('key', e.target.value)}
                    placeholder="e.g. focus"
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
                        onChange={(e) => handleChange('op', e.target.value)}
                        style={getFieldInputStyle('op')}
                        value={node.op || 'eq'}
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
                        onChange={(e) => {
                            let v: any = e.target.value;
                            if (v === 'true') v = true;
                            else if (v === 'false') v = false;
                            else if (v !== '' && !isNaN(Number(v))) v = Number(v);
                            handleChange('value', v);
                        }}
                        placeholder="true / 3 / text"
                        style={getFieldInputStyle('value')}
                        type="text"
                        value={node.value === undefined ? '' : String(node.value)}
                    />
                    <FieldError errors={getFieldErrors('value')} />
                </div>
            </div>

            <div>
                <label style={labelStyle}>Max Iterations (safety)</label>
                <input
                    min={1}
                    onChange={(e) => handleChange('maxIterations', Number(e.target.value))}
                    style={getFieldInputStyle('maxIterations')}
                    type="number"
                    value={node.maxIterations ?? 10_000}
                />
                <FieldError errors={getFieldErrors('maxIterations')} />
            </div>
        </div>
    );
}