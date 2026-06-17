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

    return actions
        .map((action) => ({
            action,
            score: scoreAction(action, normalizedQuery),
        }))
        .filter((entry) => entry.score > 0)
        .toSorted((a, b) => {
            if (a.score !== b.score) return b.score - a.score;
            return a.action.label.localeCompare(b.action.label);
        })
        .map((entry) => entry.action);
}

export function nextSelectionIndex(current: number, length: number, delta: -1 | 1): number {
    if (length <= 0) return 0;
    const next = current + delta;
    if (next < 0) return length - 1;
    if (next >= length) return 0;
    return next;
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
        hintText: action.shortcut ?? '',
        id: action.id,
        label: action.label,
    }));
}

function scoreAction(action: CommandPaletteSearchableAction, normalizedQuery: string): number {
    const haystack = `${action.label} ${action.keywords}`.toLowerCase();
    const label = action.label.toLowerCase();

    if (label.startsWith(normalizedQuery)) return 1000 - label.indexOf(normalizedQuery);

    const exactIndex = haystack.indexOf(normalizedQuery);
    if (exactIndex !== -1) return 800 - exactIndex;

    const compactQuery = normalizedQuery.replaceAll(/\s+/g, '');
    if (compactQuery.length === 0) return 0;

    const labelFuzzy = subsequenceScore(label, compactQuery);
    const haystackFuzzy = subsequenceScore(haystack, compactQuery);
    return Math.max(labelFuzzy, haystackFuzzy);
}

function subsequenceScore(target: string, query: string): number {
    let score = 0;
    let previousIndex = -1;
    let consecutiveMatches = 0;

    for (const character of query) {
        const index = target.indexOf(character, previousIndex + 1);
        if (index === -1) return 0;

        if (index === previousIndex + 1) {
            consecutiveMatches += 1;
            score += 4 + consecutiveMatches;
        } else {
            consecutiveMatches = 0;
            score += 2;
        }

        if (index <= 2) score += 2;

        previousIndex = index;
    }

    return score;
}

