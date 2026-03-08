export const getNestedArray = (root: any[], path: (number | string)[]): any[] => {
    let current: any = root;
    for (const key of path) {
        if (current && typeof current === 'object' && key in current) {
            current = current[key];
        } else {
            return [];
        }
    }
    return Array.isArray(current) ? current : [];
};

export const updateDeepScript = (root: any[], path: (number | string)[], newSubArray: any[]): any[] => {
    if (path.length === 0) return newSubArray;

    const newRoot = [...root];
    let current: any = newRoot;

    for (let index = 0; index < path.length - 1; index++) {
        const key = path[index];
        current[key] = Array.isArray(current[key]) ? [...current[key]] : { ...current[key] };
        current = current[key];
    }

    const lastKey = path.at(-1);
    current[lastKey] = newSubArray;
    return newRoot;
};