export function getEditableValue(value: unknown): string {
    return typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string' ? String(value) : '';
}


