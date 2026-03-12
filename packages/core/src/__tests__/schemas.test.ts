import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { SchemaRegistry, validateScript } from '../schemas';
import { waitCommand } from '../test-utils/scriptBuilders';

describe('schemas', () => {
    it('validateScript keeps valid commands and tolerates invalid ones', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

        const valid = waitCommand({ duration: 10 });
        const invalid = { type: 'wait' };
        const output = validateScript([valid, invalid]);

        expect(output).toHaveLength(2);
        expect(output[0]).toMatchObject(valid);
        expect(output[1]).toBe(invalid);
        expect(warn).toHaveBeenCalled();

        warn.mockRestore();
    });

    it('SchemaRegistry register/get exposes newly registered command schemas', () => {
        const customType = 'vitest_custom_command';
        const customSchema = z.object({
            payload: z.string(),
            type: z.literal(customType),
        });

        SchemaRegistry.register(customType, customSchema);

        expect(SchemaRegistry.get(customType)).toBe(customSchema);

        const commandSchema = SchemaRegistry.getCommandSchema();
        const parsedCustom = commandSchema.safeParse({ payload: 'ok', type: customType });
        const parsedUnknown = commandSchema.safeParse({ anyField: 1, type: 'unknown_runtime_type' });

        expect(parsedCustom.success).toBe(true);
        expect(parsedUnknown.success).toBe(true);
    });
});
