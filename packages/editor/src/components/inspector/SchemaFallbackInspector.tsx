import type { z } from 'zod';
import { CommandSchemaRegistry } from 'core/schemas';
import { useInspectorFieldEditor } from '../../hooks/useInspectorFieldEditor';
import { FieldError } from './FieldError';

type FieldInfo = {
    key: string;
    optional: boolean;
    kind: 'string' | 'number' | 'boolean' | 'enum' | 'unknown';
    enumValues?: string[];
};

function unwrapSchema(schema: any): any {
    let current = schema;
    while (current?._def?.innerType || current?._def?.schema) {
        current = current._def.innerType ?? current._def.schema;
    }
    return current;
}

function inferFields(type: string): FieldInfo[] {
    const schema = CommandSchemaRegistry[type] as z.ZodTypeAny | undefined;
    if (!schema) return [];

    const s: any = unwrapSchema(schema);
    const shape = typeof s?._def?.shape === 'function' ? s._def.shape() : s?._def?.shape;
    if (!shape || typeof shape !== 'object') return [];

    return Object.entries(shape)
        .filter(([k]) => k !== 'type')
        .map(([key, raw]: [string, any]) => {
            const def = raw?._def;
            const tName = def?.typeName as string | undefined;
            const inner = unwrapSchema(raw);
            const innerName = inner?._def?.typeName as string | undefined;

            if (innerName === 'ZodString') return { key, optional: tName === 'ZodOptional', kind: 'string' };
            if (innerName === 'ZodNumber') return { key, optional: tName === 'ZodOptional', kind: 'number' };
            if (innerName === 'ZodBoolean') return { key, optional: tName === 'ZodOptional', kind: 'boolean' };
            if (innerName === 'ZodEnum') {
                return {
                    key,
                    optional: tName === 'ZodOptional',
                    kind: 'enum',
                    enumValues: inner?._def?.values ?? [],
                };
            }

            return { key, optional: tName === 'ZodOptional', kind: 'unknown' };
        });
}

const HIDDEN_COMPLEX_KEYS = new Set(['then', 'else', 'body', 'commands', 'options']);

export function SchemaFallbackInspector({ node, index }: { node: any; index?: number | null }) {
    const { labelStyle, handleChange, getFieldErrors, getFieldInputStyle } = useInspectorFieldEditor(index);
    const fields = inferFields(node?.type).filter((f) => !HIDDEN_COMPLEX_KEYS.has(f.key));

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