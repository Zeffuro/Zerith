import type { FsDirectoryEntry } from '../../services/fs';

import { useProjectStore } from '../storeBootstrap';

export function executeProjectTreeRefreshAction(path: string, entries: FsDirectoryEntry[]): void {
    const project = useProjectStore.getState();
    if (project.projectPath === path) {
        project.setProjectFiles(entries);
        return;
    }

    project.setProject(path, entries);
}

export function getCurrentProjectPath(): string | undefined {
    return useProjectStore.getState().projectPath;
}

