export function basename(path: string): string {
    const normalized = normalizeVirtualPath(path);
    return normalized.split('/').pop() || normalized;
}

export function dirname(path: string): string {
    const normalized = normalizeVirtualPath(path);
    const index = normalized.lastIndexOf('/');
    if (index <= 0) return '/';
    return normalized.slice(0, index);
}

export function join(...parts: string[]): string {
    const joined = parts
        .filter((part) => part.length > 0)
        .join('/');

    return normalizeVirtualPath(joined);
}

export function normalizeVirtualPath(path: string): string {
    const normalized = path
        .replaceAll('\\', '/')
        .replaceAll(/\/+/gu, '/');

    if (!normalized) return '/';
    return normalized.startsWith('/') ? normalized : `/${normalized}`;
}

export function pathSegments(path: string): string[] {
    return normalizeVirtualPath(path)
        .split('/')
        .filter(Boolean);
}
