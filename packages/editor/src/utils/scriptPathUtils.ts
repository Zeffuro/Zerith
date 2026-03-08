export type ScriptPath = (number | string)[];

export function getAtPath<T = unknown>(root: unknown, path: ScriptPath): T | undefined {
    let current: any = root;
    for (const key of path) {
        if (current === undefined || current === null) return undefined;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        current = current[key];
    }
    return current as T;
}

export function getNodeIndex(nodePath: ScriptPath): number {
    if (!isNodePath(nodePath)) {
        throw new Error(`getNodeIndex expected node path, got: ${JSON.stringify(nodePath)}`);
    }
    return nodePath.at(-1) as number;
}

export function getParentArrayPath(nodePath: ScriptPath): ScriptPath {
    if (!isNodePath(nodePath)) {
        throw new Error(`getParentArrayPath expected node path, got: ${JSON.stringify(nodePath)}`);
    }
    return nodePath.slice(0, -1);
}

export function insertNodeAtPath(root: unknown[], arrayPath: ScriptPath, index: number, node: unknown): unknown[] {
    const array = getAtPath<unknown[]>(root, arrayPath);
    if (!Array.isArray(array)) {
        throw new TypeError(`Target at path is not an array: ${JSON.stringify(arrayPath)}`);
    }
    const newArray = [...array];
    newArray.splice(index, 0, node);
    return setAtPath(root, arrayPath, newArray);
}

export function isNodePath(path: ScriptPath): boolean {
    return path.length > 0 && typeof path.at(-1) === 'number';
}

export function moveNode(
    root: unknown[],
    nodePath: ScriptPath,
    destinationArrayPath: ScriptPath,
    destinationIndex: number | 'end'
): unknown[] {
    // 1. Remove node
    const [intermediateRoot, node] = removeNodeAtPath(root, nodePath);

    // 2. Insert at new location
    if (destinationArrayPath.length === 0) {
        // Special case: moving to the root level
        return insertNodeAtPath(intermediateRoot, destinationArrayPath, 0, node);
    }

    if (isNodePath(nodePath) && isNodePath(destinationArrayPath)) {
        const sourceIndex = getNodeIndex(nodePath);
        const destIndex = destinationIndex === 'end' ? 'end' : Math.max(0, Math.min(getNodeIndex(destinationArrayPath), Number.MAX_SAFE_INTEGER));

        // If we're moving within the same array and the destination index is greater than the source index,
        // explicitly adjust because removal shifted indices.
        // However, removeNodeAtPath creates a new root clone, so indices in other arrays are unaffected.
        // BUT if destination is in the SAME array, we need to be careful.
        if (JSON.stringify(getParentArrayPath(nodePath)) === JSON.stringify(getParentArrayPath(destinationArrayPath))) {
            if (sourceIndex < destIndex) {
                return insertNodeAtPath(intermediateRoot, destinationArrayPath, destIndex - 1, node);
            }
        }

        if (destinationIndex === 'end') {
            const destArray = getAtPath<unknown[]>(intermediateRoot, destinationArrayPath);
            return insertNodeAtPath(intermediateRoot, destinationArrayPath, destArray.length, node);
        } else {
            return insertNodeAtPath(intermediateRoot, destinationArrayPath, destinationIndex, node);
        }
    }
    return intermediateRoot;
}

export function removeNodeAtPath(root: unknown[], nodePath: ScriptPath): [unknown[], unknown] {
    const index = getNodeIndex(nodePath);
    const parentPath = getParentArrayPath(nodePath);
    const parent = getAtPath<unknown[]>(root, parentPath);

    if (!Array.isArray(parent)) {
        throw new TypeError(`Parent at path is not an array: ${JSON.stringify(parentPath)}`);
    }
    if (index < 0 || index >= parent.length) {
        throw new Error(`Index out of bounds at path: ${JSON.stringify(nodePath)}`);
    }

    const newParent = [...parent];
    const node = newParent[index];
    newParent.splice(index, 1);

    return [setAtPath(root, parentPath, newParent), node];
}

export function setAtPath(root: unknown, path: ScriptPath, value: unknown): any {
    if (path.length === 0) return value;

    const [head, ...rest] = path;
    const current = root as any;
    
    // Check if current is array or object to execute shallow copy
    const clone: any = Array.isArray(current) ? [...current] : { ...current };

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    clone[head] = setAtPath(current[head], rest, value);

    return clone;
}
