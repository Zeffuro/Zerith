export function basenameFromPath(path: string): string {
    const normalized = normalizeFilePath(path);
    const lastSlash = normalized.lastIndexOf('/');
    return lastSlash === -1 ? normalized : normalized.slice(lastSlash + 1);
}

export function isManifestFilePath(path: string): boolean {
    return basenameFromPath(path).toLowerCase() === 'game.json';
}

export function normalizeFilePath(path: string): string {
    return path.replaceAll('\\', '/');
}

export function toProjectRelativePath(fullPath: string, projectPath: string | undefined): string {
    if (!projectPath) return fullPath;
    const base = normalizeFilePath(projectPath).replace(/\/+$/, '');
    const abs = normalizeFilePath(fullPath);
    if (!abs.startsWith(base)) return fullPath;
    const rest = abs.slice(base.length);
    return rest.startsWith('/') ? rest : `/${rest}`;
}

