import { deepClone } from '@zeffuro/zerith-core';

type Indexable = Record<string, unknown> | unknown[];
type PathSegment = number | string;

export const getNestedArray = <T>(root: T[], path: PathSegment[]): T[] => {
    let current: unknown = root;
    for (const key of path) {
        if (!current || typeof current !== 'object' || !(key in current)) {
            return [];
        }
        current = (current as Record<number | string, unknown>)[key];
    }
    return Array.isArray(current) ? (current as T[]) : [];
};

export const updateDeepScript = <T>(root: T[], path: PathSegment[], newSubArray: T[]): T[] => {
    if (path.length === 0) return newSubArray;

    const newRoot = [...root];
    let current: Indexable = newRoot;

    for (let index = 0; index < path.length - 1; index++) {
        const key = path[index];
        const currentValue = (current as Record<number | string, unknown>)[key];
        if (Array.isArray(currentValue)) {
            (current as Record<number | string, unknown>)[key] = deepClone(currentValue);
        } else if (currentValue && typeof currentValue === 'object') {
            (current as Record<number | string, unknown>)[key] = { ...currentValue };
        } else {
            (current as Record<number | string, unknown>)[key] = {};
        }
        current = (current as Record<number | string, unknown>)[key] as Indexable;
    }

    const lastKey = path.at(-1);
    if (lastKey !== undefined) {
        (current as Record<number | string, unknown>)[lastKey] = newSubArray;
    }
    return newRoot;
};
