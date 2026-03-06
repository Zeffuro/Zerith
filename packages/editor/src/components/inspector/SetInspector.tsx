import { useInspectorFieldEditor } from './useInspectorFieldEditor';

export function SetInspector({ node, index }: { node: any; index?: number | null }) {
    const { labelStyle, inputStyle, handleChange } = useInspectorFieldEditor(index);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
                <label style={labelStyle}>Key</label>
                <input
                    type="text"
                    value={node.key || ''}
                    onChange={(e) => handleChange('key', e.target.value)}
                    placeholder="e.g. has_badge"
                    style={inputStyle}
                />
            </div>

            <div>
                <label style={labelStyle}>Operation</label>
                <select
                    value={node.op || 'set'}
                    onChange={(e) => handleChange('op', e.target.value)}
                    style={inputStyle}
                >
                    <option value="set">Set</option>
                    <option value="add">Add</option>
                    <option value="sub">Subtract</option>
                    <option value="toggle">Toggle</option>
                </select>
            </div>

            <div>
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
                    placeholder="true / 1 / some text"
                    style={inputStyle}
                />
            </div>
        </div>
    );
}