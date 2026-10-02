import type { FsDirectoryEntry } from '../../services/fs';

import { fsReadDirectory } from '../../services/fs';
import { useProjectStore } from '../storeBootstrap';

export async function executeExternalProjectTreeRefreshAction(path: string): Promise<void> {
    const project = useProjectStore.getState();
    if (project.projectPath !== path) return;
    const generation = project.projectGeneration;

    const entries = await fsReadDirectory(path);
    const current = useProjectStore.getState();
    if (current.projectPath !== path || current.projectGeneration !== generation) return;
    sortEntries(entries);
    current.setProjectFiles(entries);
}

export function executeProjectTreeRefreshAction(path: string, entries: FsDirectoryEntry[]): void {
    sortEntries(entries);

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

function sortEntries(entries: FsDirectoryEntry[]) {
    entries.sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        return a.name.localeCompare(b.name);
    });
}

