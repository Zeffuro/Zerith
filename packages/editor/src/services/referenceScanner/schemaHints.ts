import { SchemaRegistry } from 'core/schemas';
import { z } from 'zod';

export type CommandFieldHints = {
    assetFields: string[];
    keyFields: string[];
    speakerFields: string[];
};

export function getCommandFieldHints(commandType: string): CommandFieldHints {
    const schema = SchemaRegistry.get(commandType);
    const objectSchema = schema ? unwrapObjectSchema(schema) : undefined;
    if (!objectSchema) {
        return { assetFields: [], keyFields: [], speakerFields: [] };
    }

    const shape = objectSchema.shape;
    const keys = Object.keys(shape);
    const assetFields = keys.filter((key) => /asset(url)?/i.test(key));
    const keyFields = keys.filter((key) => key === 'key' || key.endsWith('Key'));
    const speakerFields = keys.filter((key) => key === 'speaker');
    return { assetFields, keyFields, speakerFields };
}

export function unwrapObjectSchema(
    schema: z.ZodTypeAny,
): undefined | z.ZodObject<z.ZodRawShape> {
    let current = schema;

    while (true) {
        if (current instanceof z.ZodObject) {
            return current;
        }

        if (
            current instanceof z.ZodDefault
            || current instanceof z.ZodOptional
            || current instanceof z.ZodNullable
            || current instanceof z.ZodReadonly
        ) {
            current = current.unwrap() as z.ZodTypeAny;
            continue;
        }

        return undefined;
    }
}


