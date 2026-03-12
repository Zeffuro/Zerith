export function normalizeFilePath(path: string): string {
    return path.replaceAll('\\', '/');
}

export function basenameFromPath(path: string): string {
    const normalized = normalizeFilePath(path);
    const lastSlash = normalized.lastIndexOf('/');
    return lastSlash >= 0 ? normalized.slice(lastSlash + 1) : normalized;
}

export function isManifestFilePath(path: string): boolean {
    return basenameFromPath(path).toLowerCase() === 'game.json';
}

