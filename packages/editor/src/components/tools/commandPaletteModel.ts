type CommandPaletteSearchableAction = {
    keywords: string;
    label: string;
};

type ManifestLike = {
    scenes?: Record<string, unknown>;
    startScene?: string;
};

export function filterActions<T extends CommandPaletteSearchableAction>(actions: T[], query: string): T[] {
    const normalizedQuery = query.trim().toLowerCase();
    if (normalizedQuery.length === 0) return actions;

    return actions.filter((action) => {
        const haystack = `${action.label} ${action.keywords}`.toLowerCase();
        return haystack.includes(normalizedQuery);
    });
}

export function nextSelectionIndex(current: number, length: number, delta: -1 | 1): number {
    if (length <= 0) return 0;
    if (delta > 0) return Math.min(length - 1, current + 1);
    return Math.max(0, current - 1);
}

export function resolveInitialProjectEntryPath(
    projectPath: string | undefined,
    manifest: ManifestLike | undefined,
): string | undefined {
    if (!projectPath) return;

    const startSceneName = manifest?.startScene;
    const sceneEntry = startSceneName ? manifest?.scenes?.[startSceneName] : undefined;
    if (typeof sceneEntry === 'string') {
        return resolveProjectPath(projectPath, sceneEntry);
    }

    return `${projectPath}/game.json`;
}

export function resolveProjectPath(projectPath: string, targetPath: string): string {
    if (targetPath.startsWith('/') || targetPath.startsWith('\\')) {
        return `${projectPath}${targetPath}`;
    }
    return `${projectPath}/${targetPath}`;
}

