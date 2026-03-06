export const getNestedArray = (root: any[], path: (string | number)[]): any[] => {
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

export const updateDeepScript = (root: any[], path: (string | number)[], newSubArray: any[]): any[] => {
    if (path.length === 0) return newSubArray;

    const newRoot = [...root];
    let current: any = newRoot;

    for (let i = 0; i < path.length - 1; i++) {
        const key = path[i];
        current[key] = Array.isArray(current[key]) ? [...current[key]] : { ...current[key] };
        current = current[key];
    }

    const lastKey = path[path.length - 1];
    current[lastKey] = newSubArray;
    return newRoot;
};