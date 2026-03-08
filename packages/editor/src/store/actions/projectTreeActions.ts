import type { FsDirEntry } from '../../services/fs';
import { useProjectStore } from '../useProjectStore';

export function executeProjectTreeRefreshAction(path: string, entries: FsDirEntry[]): void {
    const project = useProjectStore.getState();
    project.setProject(path, entries);
    project.bumpTreeRevision?.();
}

export function getCurrentProjectPath(): string | null {
    return useProjectStore.getState().projectPath;
}

