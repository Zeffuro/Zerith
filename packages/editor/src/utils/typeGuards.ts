export function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function toRecord(value: unknown): Record<string, unknown> {
    if (!isRecord(value)) return {};
    return value;
}

export function toRecordOrUndefined(value: unknown): Record<string, unknown> | undefined {
    return value && typeof value === 'object' ? (value as Record<string, unknown>) : undefined;
}

