import { z } from 'zod';

import type { LocaleBundle, LocalizationConfig } from '../types/Localization';

import { ContentSchemaVersionSchema } from './contentVersionSchemas';

const NonEmptyStringSchema = z.string().trim().min(1);

export const LocaleBundleSchema: z.ZodType<LocaleBundle> = z.looseObject({
    $schema: z.literal('zerith/locale').optional(),
    locale: NonEmptyStringSchema,
    namespaces: z.record(
        NonEmptyStringSchema,
        z.record(NonEmptyStringSchema, z.string()),
    ),
    schemaVersion: ContentSchemaVersionSchema.optional(),
});

export const LocalizationConfigSchema: z.ZodType<LocalizationConfig> = z.looseObject({
    defaultLocale: NonEmptyStringSchema.optional(),
    locales: z.record(
        NonEmptyStringSchema,
        z.union([
            NonEmptyStringSchema,
            LocaleBundleSchema,
        ]),
    ).optional(),
});

type ParseLocaleBundleResult =
    | { data: LocaleBundle; success: true }
    | { error: string; success: false };

export function parseLocaleBundle(data: unknown): ParseLocaleBundleResult {
    const parsed = LocaleBundleSchema.safeParse(data);

    return parsed.success
        ? { data: parsed.data, success: true }
        : { error: formatError(parsed.error), success: false };
}

function formatError(error: z.ZodError): string {
    const [firstIssue] = error.issues;

    if (!firstIssue) {
        return 'Invalid locale bundle.';
    }

    const path = firstIssue.path.length > 0 ? `${firstIssue.path.join('.')}: ` : '';

    return `${path}${firstIssue.message}`;
}
