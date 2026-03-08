import { CommandSchemaRegistry } from 'core/schemas';
import { z } from 'zod';

export type FieldInfo = {
    enumValues?: string[];
    key: string;
    kind: ScalarKind;
    optional: boolean;
};

type ScalarKind = 'boolean' | 'enum' | 'number' | 'string' | 'unknown';

type UnwrapResult = {
    optional: boolean;
    schema: z.ZodTypeAny;
};

export function inferCommandFields(type: string): FieldInfo[] {
    const rawSchema = CommandSchemaRegistry[type] as undefined | z.ZodTypeAny;
    if (!rawSchema) return [];

    const { schema } = unwrapSchema(rawSchema);
    if (!(schema instanceof z.ZodObject)) return [];

    const shape = schema.shape;

    return Object.entries(shape)
        .filter(([key]) => key !== 'type')
        .map(([key, rawFieldSchema]) => {
            const { optional, schema: fieldSchema } = unwrapSchema(rawFieldSchema);
            return {
                key,
                optional,
                ...inferFieldKind(fieldSchema),
            };
        });
}

function inferFieldKind(schema: z.ZodTypeAny): Omit<FieldInfo, 'key' | 'optional'> {
    if (schema instanceof z.ZodString) return { kind: 'string' };
    if (schema instanceof z.ZodNumber) return { kind: 'number' };
    if (schema instanceof z.ZodBoolean) return { kind: 'boolean' };

    if (schema instanceof z.ZodEnum) {
        const enumValues = [...schema.options].filter((v): v is string => typeof v === 'string');
        return { enumValues, kind: 'enum' };
    }

    return { kind: 'unknown' };
}

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

    return { optional, schema };
}

