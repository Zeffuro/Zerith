import { useInspectorFieldEditor } from '../../hooks/useInspectorFieldEditor';
import { inferCommandFields } from '../../utils/zodInference';
import { FieldError } from './FieldError';


const HIDDEN_COMPLEX_KEYS = new Set(['body', 'commands', 'else', 'options', 'then']);

export function SchemaFallbackInspector({ index, node }: { index?: null | number; node: any; }) {
    const { getFieldErrors, getFieldInputStyle, handleChange, labelStyle } = useInspectorFieldEditor(index);
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
                                onChange={(e) => handleChange(f.key, e.target.value === 'true')}
                                style={getFieldInputStyle(f.key)}
                                value={value ? 'true' : 'false'}
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
                                onChange={(e) =>
                                    handleChange(f.key, e.target.value === '' ? undefined : Number(e.target.value))
                                }
                                style={getFieldInputStyle(f.key)}
                                type="number"
                                value={value ?? ''}
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
                                onChange={(e) => handleChange(f.key, e.target.value)}
                                style={getFieldInputStyle(f.key)}
                                value={value ?? ''}
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
                                    background: '#151515',
                                    borderStyle: 'dashed',
                                    color: '#888',
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
                            onChange={(e) => handleChange(f.key, e.target.value)}
                            style={getFieldInputStyle(f.key)}
                            type="text"
                            value={value ?? ''}
                        />
                        <FieldError errors={getFieldErrors(f.key)} />
                    </div>
                );
            })}
        </div>
    );
}