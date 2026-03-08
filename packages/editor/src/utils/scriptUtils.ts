export const getNestedArray = (root: unknown[], path: (number | string)[]): unknown[] => {
    let current: unknown = root;
    for (const key of path) {
        if (current && typeof current === 'object' && key in current) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            current = (current as any)[key];
        } else {
            return [];
        }
    }
    return Array.isArray(current) ? current : [];
};

export const updateDeepScript = (root: unknown[], path: (number | string)[], newSubArray: unknown[]): unknown[] => {
    if (path.length === 0) return newSubArray;

    const newRoot = [...root];
    let current: any = newRoot;

    for (let index = 0; index < path.length - 1; index++) {
        const key = path[index];
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        current[key] = Array.isArray(current[key]) ? [...current[key]] : { ...current[key] };
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        current = current[key];
    }

    const lastKey = path.at(-1);
    if (lastKey !== undefined) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        current[lastKey] = newSubArray;
    }
    return newRoot;
};