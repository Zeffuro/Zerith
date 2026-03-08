import { useInspectorFieldEditor } from '../../hooks/useInspectorFieldEditor';
import { FieldError } from './FieldError';

export function SetInspector({ index, node }: { index?: null | number; node: any; }) {
    const { getFieldErrors, getFieldInputStyle, handleChange, labelStyle } = useInspectorFieldEditor(index);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
                <label style={labelStyle}>Key</label>
                <input
                    onChange={(e) => handleChange('key', e.target.value)}
                    placeholder="e.g. has_badge"
                    style={getFieldInputStyle('key')}
                    type="text"
                    value={node.key || ''}
                />
                <FieldError errors={getFieldErrors('key')} />
            </div>

            <div>
                <label style={labelStyle}>Operation</label>
                <select
                    onChange={(e) => handleChange('op', e.target.value)}
                    style={getFieldInputStyle('op')}
                    value={node.op || 'set'}
                >
                    <option value="set">Set</option>
                    <option value="add">Add</option>
                    <option value="sub">Subtract</option>
                    <option value="toggle">Toggle</option>
                </select>
                <FieldError errors={getFieldErrors('op')} />
            </div>

            <div>
                <label style={labelStyle}>Value</label>
                <input
                    onChange={(e) => {
                        let v: any = e.target.value;
                        if (v === 'true') v = true;
                        else if (v === 'false') v = false;
                        else if (v !== '' && !isNaN(Number(v))) v = Number(v);
                        handleChange('value', v);
                    }}
                    placeholder="true / 1 / some text"
                    style={getFieldInputStyle('value')}
                    type="text"
                    value={node.value === undefined ? '' : String(node.value)}
                />
                <FieldError errors={getFieldErrors('value')} />
            </div>
        </div>
    );
}