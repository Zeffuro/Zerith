import type { ScriptPath } from '../../utils/scriptPathUtilities';

export function getAtPath(value: unknown, path: ScriptPath): unknown {
    let current: unknown = value;
    for (const segment of path) {
        if (typeof segment === 'number') {
            if (!Array.isArray(current)) return undefined;
            current = current[segment];
            continue;
        }

        if (!current || typeof current !== 'object') return undefined;
        current = (current as Record<string, unknown>)[segment];
    }
    return current;
}

export function setAtPath(target: unknown, path: ScriptPath, value: unknown): boolean {
    if (path.length === 0) return false;

    let current: unknown = target;
    for (const [index, segment] of path.entries()) {
        const isLast = index === path.length - 1;

        if (typeof segment === 'number') {
            if (!Array.isArray(current) || segment < 0 || segment >= current.length) return false;
            if (isLast) {
                current[segment] = value;
                return true;
            }
            current = current[segment];
            continue;
        }

        if (!current || typeof current !== 'object' || Array.isArray(current)) return false;
        const currentRecord = current as Record<string, unknown>;
        if (isLast) {
            currentRecord[segment] = value;
            return true;
        }
        current = currentRecord[segment];
    }

    return false;
}

