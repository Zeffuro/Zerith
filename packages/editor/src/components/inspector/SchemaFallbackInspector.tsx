import type { BaseCommand } from '@zeffuro/zerith-core';

import { useInspectorFieldEditor } from '../../hooks/useInspectorFieldEditor';
import { editorTheme as t } from '../../theme/editorTheme';
import { inferCommandFields } from '../../utils/zodInference';
import { FieldError } from './FieldError';

const HIDDEN_COMPLEX_KEYS = new Set(['body', 'commands', 'else', 'onFalse', 'onTrue', 'options', 'then']);

const getNodeFieldValue = (node: BaseCommand, key: string): unknown => (node as Record<string, unknown>)[key];

export function SchemaFallbackInspector({ index, node }: { index?: null | number; node: BaseCommand; }) {
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
                const value = getNodeFieldValue(node, f.key);

                if (f.kind === 'boolean') {
                    return (
                        <div key={f.key}>
                            <label style={labelStyle}>{f.key}</label>
                            <select
                                onChange={(event) => handleChange(f.key, event.target.value === 'true')}
                                style={getFieldInputStyle(f.key)}
                                value={value === true ? 'true' : 'false'}
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
                                onChange={(event) =>
                                    handleChange(f.key, event.target.value === '' ? undefined : Number(event.target.value))
                                }
                                style={getFieldInputStyle(f.key)}
                                type="number"
                                value={typeof value === 'number' ? value : ''}
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
                                onChange={(event) => handleChange(f.key, event.target.value)}
                                style={getFieldInputStyle(f.key)}
                                value={typeof value === 'string' ? value : ''}
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
                                    background: t.bg.panelAlt,
                                    borderStyle: 'dashed',
                                    color: t.text.muted,
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
                            onChange={(event) => handleChange(f.key, event.target.value)}
                            style={getFieldInputStyle(f.key)}
                            type="text"
                            value={typeof value === 'string' ? value : ''}
                        />
                        <FieldError errors={getFieldErrors(f.key)} />
                    </div>
                );
            })}
        </div>
    );
}