import { z } from 'zod';

import type { AudioCue, AudiosheetDescriptor, SheetDescriptor, SpriteFrame, SpritesheetDescriptor } from '../types';

import { ContentSchemaVersionSchema } from './contentVersionSchemas';

const nonNegativeNumberSchema = z.float64().nonnegative();
const positiveNumberSchema = z.float64().positive();
const nonNegativeIntegerSchema = z.int().nonnegative();
const positiveIntegerSchema = z.int().positive();

export const spriteFrameSchema: z.ZodType<SpriteFrame> = z.object({
    anchorX: z.float64().optional(),
    anchorY: z.float64().optional(),
    h: positiveNumberSchema,
    name: z.string().min(1),
    w: positiveNumberSchema,
    x: nonNegativeNumberSchema,
    y: nonNegativeNumberSchema,
});

export const spritesheetDescriptorSchema: z.ZodType<SpritesheetDescriptor> = z.object({
    animations: z.record(z.string(), z.array(z.string().min(1))).optional(),
    atlasJsonPath: z.string().min(1).optional(),
    chromaKey: z.string().min(1).optional(),
    chromaTolerance: nonNegativeNumberSchema.optional(),
    format: z.enum(['atlas', 'grid']),
    frameHeight: positiveIntegerSchema.optional(),
    frames: z.record(z.string(), spriteFrameSchema).optional(),
    frameWidth: positiveIntegerSchema.optional(),
    margin: nonNegativeIntegerSchema.optional(),
    meta: z.record(z.string(), z.unknown()).optional(),
    schemaVersion: ContentSchemaVersionSchema.optional(),
    source: z.string().min(1),
    spacing: nonNegativeIntegerSchema.optional(),
}).superRefine((value, context) => {
    if (value.format === 'grid' && (value.frameWidth === undefined || value.frameHeight === undefined)) {
        context.addIssue({
            code: 'custom',
            message: 'Grid format requires frameWidth and frameHeight.',
            path: ['format'],
        });
    }

    if (value.format === 'atlas' && value.frames === undefined && value.atlasJsonPath === undefined) {
        context.addIssue({
            code: 'custom',
            message: 'Atlas format requires frames or atlasJsonPath.',
            path: ['format'],
        });
    }
});

export const audioCueSchema: z.ZodType<AudioCue> = z.object({
    duration: positiveNumberSchema.optional(),
    loop: z.boolean().optional(),
    start: nonNegativeNumberSchema,
    volume: nonNegativeNumberSchema.optional(),
});

export const audiosheetDescriptorSchema: z.ZodType<AudiosheetDescriptor> = z.object({
    cues: z.record(z.string(), audioCueSchema),
    meta: z.record(z.string(), z.unknown()).optional(),
    schemaVersion: ContentSchemaVersionSchema.optional(),
    source: z.string().min(1),
});

export const sheetDescriptorSchema: z.ZodType<SheetDescriptor> = z.union([
    spritesheetDescriptorSchema,
    audiosheetDescriptorSchema,
]);

type ParseAudiosheetDescriptorResult =
    | { data: AudiosheetDescriptor; success: true }
    | { error: string; success: false };

type ParseSheetDescriptorResult =
    | { data: SheetDescriptor; success: true }
    | { error: string; success: false };

type ParseSpritesheetDescriptorResult =
    | { data: SpritesheetDescriptor; success: true }
    | { error: string; success: false };

export function parseAudiosheetDescriptor(data: unknown): ParseAudiosheetDescriptorResult {
    const parsed = audiosheetDescriptorSchema.safeParse(data);

    return parsed.success
        ? { data: parsed.data, success: true }
        : { error: formatError(parsed.error), success: false };
}

export function parseSheetDescriptor(data: unknown): ParseSheetDescriptorResult {
    const parsed = sheetDescriptorSchema.safeParse(data);

    return parsed.success
        ? { data: parsed.data, success: true }
        : { error: formatError(parsed.error), success: false };
}

export function parseSpritesheetDescriptor(data: unknown): ParseSpritesheetDescriptorResult {
    const parsed = spritesheetDescriptorSchema.safeParse(data);

    return parsed.success
        ? { data: parsed.data, success: true }
        : { error: formatError(parsed.error), success: false };
}

function formatError(error: z.ZodError): string {
    const [firstIssue] = error.issues;

    if (!firstIssue) {
        return 'Invalid descriptor.';
    }

    const path = firstIssue.path.length > 0 ? `${firstIssue.path.join('.')}: ` : '';

    return `${path}${firstIssue.message}`;
}

