export type ScriptPath = (number | string)[];

type Indexable = Record<string, unknown> | unknown[];

export function getAtPath<T = unknown>(root: unknown, path: ScriptPath): T | undefined {
    let current: unknown = root;
    for (const key of path) {
        if (current === undefined) return undefined;
        current = readAtKey(current, key);
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

export function insertNodeAtPath<TRoot extends unknown[]>(root: TRoot, arrayPath: ScriptPath, index: number, node: unknown): TRoot {
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

export function moveNode<TRoot extends unknown[]>(
    root: TRoot,
    nodePath: ScriptPath,
    destinationArrayPath: ScriptPath,
    destinationIndex: 'end' | number
): TRoot {
    const sourceParentPath = getParentArrayPath(nodePath);
    const sourceIndex = getNodeIndex(nodePath);
    const adjustedDestinationArrayPath = adjustArrayPathAfterRemoval(destinationArrayPath, sourceParentPath, sourceIndex);

    const [intermediateRoot, node] = removeNodeAtPath(root, nodePath);

    const destinationArray = getAtPath<unknown[]>(intermediateRoot, adjustedDestinationArrayPath);
    if (!Array.isArray(destinationArray)) {
        throw new TypeError(`Destination at path is not an array: ${JSON.stringify(adjustedDestinationArrayPath)}`);
    }

    const destinationIndexValue = destinationIndex === 'end'
        ? destinationArray.length
        : destinationIndex;

    let adjustedIndex = destinationIndexValue;
    if (samePath(sourceParentPath, adjustedDestinationArrayPath) && sourceIndex < destinationIndexValue) {
        adjustedIndex -= 1;
    }

    const insertIndex = Math.max(0, Math.min(adjustedIndex, destinationArray.length));
    return insertNodeAtPath(intermediateRoot, adjustedDestinationArrayPath, insertIndex, node);
}

export function removeNodeAtPath<TRoot extends unknown[]>(root: TRoot, nodePath: ScriptPath): [TRoot, unknown] {
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

export function setAtPath<TRoot>(root: TRoot, path: ScriptPath, value: unknown): TRoot {
    if (path.length === 0) return value as TRoot;

    const [head, ...rest] = path;
    const currentContainer: Indexable = isIndexable(root) ? root : (typeof head === 'number' ? [] : {});
    const currentValue = readAtKey(currentContainer, head);
    const nextValue = setAtPath(currentValue, rest, value);
    return writeAtKey(currentContainer, head, nextValue) as TRoot;
}

function adjustArrayPathAfterRemoval(destinationArrayPath: ScriptPath, sourceParentPath: ScriptPath, sourceIndex: number): ScriptPath {
    if (destinationArrayPath.length <= sourceParentPath.length) {
        return destinationArrayPath;
    }

    const parentPrefix = destinationArrayPath.slice(0, sourceParentPath.length);
    if (!samePath(parentPrefix, sourceParentPath)) {
        return destinationArrayPath;
    }

    const siblingSegment = destinationArrayPath[sourceParentPath.length];
    if (typeof siblingSegment !== 'number' || siblingSegment <= sourceIndex) {
        return destinationArrayPath;
    }

    const nextPath = [...destinationArrayPath];
    nextPath[sourceParentPath.length] = siblingSegment - 1;
    return nextPath;
}

function isIndexable(value: unknown): value is Indexable {
    return Boolean(value) && typeof value === 'object';
}

function readAtKey(value: unknown, key: number | string): unknown {
    if (!isIndexable(value)) return undefined;
    return value[key as keyof typeof value];
}

function samePath(a: ScriptPath, b: ScriptPath): boolean {
    return a.length === b.length && a.every((segment, index) => segment === b[index]);
}


function writeAtKey(value: Indexable, key: number | string, nextValue: unknown): Indexable {
    if (Array.isArray(value)) {
        const clonedArray = [...value];
        clonedArray[key as number] = nextValue;
        return clonedArray;
    }

    return {
        ...value,
        [key]: nextValue,
    };
}



