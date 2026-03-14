import { resolveInitialProjectEntryPath } from './commandPaletteModel';

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

