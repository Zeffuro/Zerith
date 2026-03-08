import { useInspectorFieldEditor } from '../../hooks/useInspectorFieldEditor';
import { FieldError } from './FieldError';
import { inferCommandFields } from '../../utils/zodInference';


const HIDDEN_COMPLEX_KEYS = new Set(['then', 'else', 'body', 'commands', 'options']);

export function SchemaFallbackInspector({ node, index }: { node: any; index?: number | null }) {
    const { labelStyle, handleChange, getFieldErrors, getFieldInputStyle } = useInspectorFieldEditor(index);
    const fields = inferCommandFields(node?.type).filter((f) => !HIDDEN_COMPLEX_KEYS.has(f.key));

    if (!node?.type) {
        return <div style={{ color: '#777', fontStyle: 'italic' }}>Invalid node.</div>;
    }

    if (fields.length === 0) {
        return (
            <div style={{ color: '#777', fontStyle: 'italic' }}>
                No schema-derived scalar fields for "{node.type}".
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {fields.map((f) => {
                const value = node[f.key];

                if (f.kind === 'boolean') {
                    return (
                        <div key={f.key}>
                            <label style={labelStyle}>{f.key}</label>
                            <select
                                value={value ? 'true' : 'false'}
                                onChange={(e) => handleChange(f.key, e.target.value === 'true')}
                                style={getFieldInputStyle(f.key)}
                            >
                                <option value="false">false</option>
                                <option value="true">true</option>
                            </select>
                            <FieldError errors={getFieldErrors(f.key)} />
                        </div>
                    );
                }

                if (f.kind === 'number') {
                    return (
                        <div key={f.key}>
                            <label style={labelStyle}>{f.key}</label>
                            <input
                                type="number"
                                value={value ?? ''}
                                onChange={(e) =>
                                    handleChange(f.key, e.target.value === '' ? undefined : Number(e.target.value))
                                }
                                style={getFieldInputStyle(f.key)}
                            />
                            <FieldError errors={getFieldErrors(f.key)} />
                        </div>
                    );
                }

                if (f.kind === 'enum' && f.enumValues) {
                    return (
                        <div key={f.key}>
                            <label style={labelStyle}>{f.key}</label>
                            <select
                                value={value ?? ''}
                                onChange={(e) => handleChange(f.key, e.target.value)}
                                style={getFieldInputStyle(f.key)}
                            >
                                <option value="">(unset)</option>
                                {f.enumValues.map((v) => (
                                    <option key={v} value={v}>
                                        {v}
                                    </option>
                                ))}
                            </select>
                            <FieldError errors={getFieldErrors(f.key)} />
                        </div>
                    );
                }

                if (f.kind === 'unknown') {
                    return (
                        <div key={f.key}>
                            <label style={labelStyle}>{f.key}</label>
                            <div
                                style={{
                                    ...getFieldInputStyle(f.key),
                                    color: '#888',
                                    background: '#151515',
                                    borderStyle: 'dashed',
                                }}
                            >
                                Complex field (not inline editable in fallback inspector).
                            </div>
                            <FieldError errors={getFieldErrors(f.key)} />
                        </div>
                    );
                }

                return (
                    <div key={f.key}>
                        <label style={labelStyle}>{f.key}</label>
                        <input
                            type="text"
                            value={value ?? ''}
                            onChange={(e) => handleChange(f.key, e.target.value)}
                            style={getFieldInputStyle(f.key)}
                        />
                        <FieldError errors={getFieldErrors(f.key)} />
                    </div>
                );
            })}
        </div>
    );
}