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
    const [intermediateRoot, node] = removeNodeAtPath(root, nodePath);

    if (destinationArrayPath.length === 0) {
        return insertNodeAtPath(intermediateRoot, destinationArrayPath, 0, node);
    }

    if (isNodePath(nodePath) && isNodePath(destinationArrayPath)) {
        const sourceIndex = getNodeIndex(nodePath);
        const boundedDestinationIndex = destinationIndex === 'end'
            ? undefined
            : Math.max(0, Math.min(getNodeIndex(destinationArrayPath), Number.MAX_SAFE_INTEGER));

        if (
            boundedDestinationIndex !== undefined
            && JSON.stringify(getParentArrayPath(nodePath)) === JSON.stringify(getParentArrayPath(destinationArrayPath))
            && sourceIndex < boundedDestinationIndex
        ) {
                return insertNodeAtPath(intermediateRoot, destinationArrayPath, boundedDestinationIndex - 1, node);
            }

        if (destinationIndex === 'end') {
            const destinationArray = getAtPath<unknown[]>(intermediateRoot, destinationArrayPath);
            if (!Array.isArray(destinationArray)) {
                throw new TypeError(`Destination at path is not an array: ${JSON.stringify(destinationArrayPath)}`);
            }
            return insertNodeAtPath(intermediateRoot, destinationArrayPath, destinationArray.length, node);
        } else {
            return insertNodeAtPath(intermediateRoot, destinationArrayPath, destinationIndex, node);
        }
    }
    return intermediateRoot;
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

function isIndexable(value: unknown): value is Indexable {
    return Boolean(value) && typeof value === 'object';
}

function readAtKey(value: unknown, key: number | string): unknown {
    if (!isIndexable(value)) return undefined;
    return value[key as keyof typeof value];
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



