import type { PaletteAction } from './commandPaletteActionsModel';

export type RenderablePaletteAction = {
    hintText: string;
    id: string;
    label: string;
};

type CommandPaletteSearchableAction = {
    keywords: string;
    label: string;
};

type ManifestLike = {
    scenes?: Record<string, unknown>;
    startScene?: string;
};

type OpenInitialProjectEntryDeps = {
    expandToPath: (path: string) => void;
    manifest: ManifestLike | undefined;
    openProjectEntry: (path: string, name: string) => Promise<void>;
    projectPath: string | undefined;
};

export function basename(path: string): string {
    return path.split(/[\\/]/).pop() || path;
}

export function clampRenderSelection(selectedIndex: number, actionCount: number): number {
    if (actionCount <= 0) return 0;
    if (selectedIndex < 0) return 0;
    if (selectedIndex >= actionCount) return actionCount - 1;
    return selectedIndex;
}

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

export async function openInitialProjectEntry({
    expandToPath,
    manifest,
    openProjectEntry,
    projectPath,
}: OpenInitialProjectEntryDeps): Promise<void> {
    const initialPath = resolveInitialProjectEntryPath(projectPath, manifest);
    if (!initialPath) return;

    expandToPath(initialPath);
    await openProjectEntry(initialPath, basename(initialPath));
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

export function shouldShowEmptyActions(actionCount: number): boolean {
    return actionCount === 0;
}

export function toRenderableActions(actions: PaletteAction[]): RenderablePaletteAction[] {
    return actions.map((action) => ({
        hintText: action.hint ?? '',
        id: action.id,
        label: action.label,
    }));
}

