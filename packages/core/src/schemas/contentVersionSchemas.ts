import { z } from 'zod';

export const CURRENT_CONTENT_SCHEMA_VERSION = 2 as const;
export const LEGACY_CONTENT_SCHEMA_VERSION = 1 as const;

export const ContentSchemaVersionSchema = z.union([
    z.literal(LEGACY_CONTENT_SCHEMA_VERSION),
    z.literal(CURRENT_CONTENT_SCHEMA_VERSION),
]);

export type ContentSchemaVersion = z.infer<typeof ContentSchemaVersionSchema>;
