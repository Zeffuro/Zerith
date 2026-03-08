import { z } from 'zod';
import { CommandSchemaRegistry } from 'core/schemas';

type ScalarKind = 'string' | 'number' | 'boolean' | 'enum' | 'unknown';

export type FieldInfo = {
    key: string;
    optional: boolean;
    kind: ScalarKind;
    enumValues?: string[];
};

type UnwrapResult = {
    schema: z.ZodTypeAny;
    optional: boolean;
};

function unwrapSchema(raw: z.ZodTypeAny): UnwrapResult {
    let schema = raw;
    let optional = false;

    while (true) {
        if (schema instanceof z.ZodOptional) {
            optional = true;
            schema = schema.unwrap() as z.ZodTypeAny;
            continue;
        }

        if (schema instanceof z.ZodNullable) {
            schema = schema.unwrap() as z.ZodTypeAny;
            continue;
        }

        if (schema instanceof z.ZodDefault) {
            optional = true;
            schema = schema.unwrap() as z.ZodTypeAny;
            continue;
        }

        if (schema instanceof z.ZodReadonly) {
            schema = schema.unwrap() as z.ZodTypeAny;
            continue;
        }

        break;
    }

    return { schema, optional };
}

function inferFieldKind(schema: z.ZodTypeAny): Omit<FieldInfo, 'key' | 'optional'> {
    if (schema instanceof z.ZodString) return { kind: 'string' };
    if (schema instanceof z.ZodNumber) return { kind: 'number' };
    if (schema instanceof z.ZodBoolean) return { kind: 'boolean' };

    if (schema instanceof z.ZodEnum) {
        const enumValues = [...schema.options].filter((v): v is string => typeof v === 'string');
        return { kind: 'enum', enumValues };
    }

    return { kind: 'unknown' };
}

export function inferCommandFields(type: string): FieldInfo[] {
    const rawSchema = CommandSchemaRegistry[type] as z.ZodTypeAny | undefined;
    if (!rawSchema) return [];

    const { schema } = unwrapSchema(rawSchema);
    if (!(schema instanceof z.ZodObject)) return [];

    const shape = schema.shape;

    return Object.entries(shape)
        .filter(([key]) => key !== 'type')
        .map(([key, rawFieldSchema]) => {
            const { schema: fieldSchema, optional } = unwrapSchema(rawFieldSchema);
            return {
                key,
                optional,
                ...inferFieldKind(fieldSchema),
            };
        });
}

