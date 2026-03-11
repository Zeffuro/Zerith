export function deepClone<T>(value: T): T {
    if (typeof globalThis.structuredClone === 'function') {
        return globalThis.structuredClone(value);
    }

    return cloneFallback(value);
}

function cloneFallback<T>(value: T): T {
    if (value === null || typeof value !== 'object') {
        return value;
    }

    if (Array.isArray(value)) {
        const clonedArray = (value as unknown[]).map((item) => cloneFallback(item));
        return clonedArray as T;
    }

    const result: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
        result[key] = cloneFallback(item);
    }

    return result as T;
}


