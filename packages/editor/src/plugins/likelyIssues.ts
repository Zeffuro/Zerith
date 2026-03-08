function asObject(value: unknown): Record<string, unknown> | null {
    return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

export function hasLikelyIssue(node: unknown): boolean {
    const obj = asObject(node);
    if (!obj || typeof obj.type !== 'string') return true;

    switch (obj.type) {
        case 'dialogue':
            return typeof obj.text !== 'string';
        case 'jump':
            return typeof obj.to !== 'string' || obj.to.trim() === '';
        case 'call':
            return typeof obj.name !== 'string' || obj.name.trim() === '';
        case 'background':
            return typeof obj.assetUrl !== 'string' || obj.assetUrl.trim() === '';
        case 'sfx':
            return typeof obj.assetUrl !== 'string' || obj.assetUrl.trim() === '';
        case 'label':
            return typeof obj.name !== 'string' || obj.name.trim() === '';
        case 'goto':
            return typeof obj.label !== 'string' || obj.label.trim() === '';
        case 'if':
            return !Array.isArray(obj.then) || !Array.isArray(obj.else);
        case 'while':
            return !Array.isArray(obj.body);
        case 'for':
            return !Array.isArray(obj.body);
        default:
            return false;
    }
}
