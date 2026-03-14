export function resolveFilePath(projectPath: string, manifestPath?: string): string {
    if (!manifestPath) return `${projectPath}/game.json`;
    if (manifestPath.startsWith('/') || manifestPath.startsWith('\\')) {
        return `${projectPath}${manifestPath}`;
    }
    return `${projectPath}/${manifestPath}`;
}

export function resolveScenePath(
    projectPath: string,
    sceneName: string,
    sceneSources: Record<string, unknown>,
): string | undefined {
    if (!(sceneName in sceneSources)) return undefined;
    const source = sceneSources[sceneName];

    if (typeof source === 'string') {
        return resolveFilePath(projectPath, source);
    }

    return `${projectPath}/game.json`;
}


