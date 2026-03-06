export type ScriptPath = (string | number)[];

export function isNodePath(path: ScriptPath): boolean {
    return path.length > 0 && typeof path[path.length - 1] === 'number';
}

export function getParentArrayPath(nodePath: ScriptPath): ScriptPath {
    if (!isNodePath(nodePath)) {
        throw new Error(`getParentArrayPath expected node path, got: ${JSON.stringify(nodePath)}`);
    }
    return nodePath.slice(0, -1);
}

export function getNodeIndex(nodePath: ScriptPath): number {
    if (!isNodePath(nodePath)) {
        throw new Error(`getNodeIndex expected node path, got: ${JSON.stringify(nodePath)}`);
    }
    return nodePath[nodePath.length - 1] as number;
}

export function getAtPath<T = any>(root: any, path: ScriptPath): T | undefined {
    let current = root;
    for (const key of path) {
        if (current == null) return undefined;
        current = current[key as any];
    }
    return current as T;
}

export function setAtPath(root: any, path: ScriptPath, value: any): any {
    if (path.length === 0) return value;

    const [head, ...rest] = path;
    const isArray = Array.isArray(root);
    const clone = isArray ? [...root] : { ...root };

    clone[head as any] = setAtPath(clone[head as any], rest, value);
    return clone;
}

export function removeNodeAtPath(root: any[], nodePath: ScriptPath): [any[], any] {
    const parentPath = getParentArrayPath(nodePath);
    const index = getNodeIndex(nodePath);
    const parent = getAtPath<any[]>(root, parentPath);

    if (!Array.isArray(parent)) {
        throw new Error(`Parent at path is not an array: ${JSON.stringify(parentPath)}`);
    }
    if (index < 0 || index >= parent.length) {
        throw new Error(`Index out of bounds at path: ${JSON.stringify(nodePath)}`);
    }

    const newParent = [...parent];
    const [removed] = newParent.splice(index, 1);
    const newRoot = setAtPath(root, parentPath, newParent);
    return [newRoot, removed];
}

export function insertNodeAtPath(root: any[], arrayPath: ScriptPath, index: number, node: any): any[] {
    const arr = getAtPath<any[]>(root, arrayPath);
    if (!Array.isArray(arr)) {
        throw new Error(`Target at path is not an array: ${JSON.stringify(arrayPath)}`);
    }

    const clamped = Math.max(0, Math.min(index, arr.length));
    const newArr = [...arr];
    newArr.splice(clamped, 0, node);
    return setAtPath(root, arrayPath, newArr);
}

export function moveNodeByPath(
    root: any[],
    sourceNodePath: ScriptPath,
    targetArrayPath: ScriptPath,
    targetIndex: number
): any[] {
    const sourceParentPath = getParentArrayPath(sourceNodePath);
    const sourceIndex = getNodeIndex(sourceNodePath);

    let working = root;
    let removed: any;
    [working, removed] = removeNodeAtPath(working, sourceNodePath);

    const sameParent =
        sourceParentPath.length === targetArrayPath.length &&
        sourceParentPath.every((v, i) => v === targetArrayPath[i]);

    const adjustedIndex = sameParent && sourceIndex < targetIndex ? targetIndex - 1 : targetIndex;

    working = insertNodeAtPath(working, targetArrayPath, adjustedIndex, removed);
    return working;
}