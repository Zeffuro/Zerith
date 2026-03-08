import { executeConsoleMessageAction } from '../store/actions/consoleMessageActions';
import { executeProjectTreeRefreshAction, getCurrentProjectPath } from '../store/actions/projectTreeActions';
import { useProjectStore } from '../store/useProjectStore';
import { useWorkbenchStore } from '../store/useWorkbenchStore';
import {
    type FsDirectoryEntry,
    fsDirname,
    fsJoin,
    fsMkdir,
    fsOpenPath,
    fsReadBinaryFile,
    fsReadDirectory,
    fsRemove,
    fsRename,
    fsWriteBinaryFile,
    fsWriteTextFile,
} from './fs';

export async function createFileInDirectory(directoryPath: string, name: string, initialContent = '') {
    try {
        const full = await fsJoin(directoryPath, name);
        await fsWriteTextFile(full, initialContent);
        await refreshProjectTree();
        return full;
    } catch (error) {
        console.error('Create file failed:', error);
        executeConsoleMessageAction('editor', 'error', 'Create file failed:', String(error));
        return;
    }
}

export async function createFolderInDirectory(directoryPath: string, name: string) {
    try {
        const full = await fsJoin(directoryPath, name);
        await fsMkdir(full, true);
        await refreshProjectTree();
        return full;
    } catch (error) {
        console.error('Create folder failed:', error);
        executeConsoleMessageAction('editor', 'error', 'Create folder failed:', String(error));
        return;
    }
}

export async function deletePath(path: string) {
    try {
        await fsRemove(path, true);
        await refreshProjectTree();
    } catch (error) {
        console.error('Delete failed:', error);
        executeConsoleMessageAction('editor', 'error', 'Delete failed:', String(error));
    }
}

export async function duplicatePath(path: string) {
    try {
        const parent = await fsDirname(path);
        const sourceName = basename(path);
        const siblingEntries = await fsReadDirectory(parent);
        const siblingNames = new Set(siblingEntries.map((entry) => entry.name));

        const duplicateName = makeDuplicateName(sourceName, siblingNames);
        const targetPath = await fsJoin(parent, duplicateName);

        const bytes = await fsReadBinaryFile(path);
        await fsWriteBinaryFile(targetPath, bytes);
        await refreshProjectTree();
        return targetPath;
    } catch (error) {
        console.error('Duplicate failed:', error);
        executeConsoleMessageAction('editor', 'error', 'Duplicate failed:', String(error));
        return;
    }
}

export async function refreshProjectTree() {
    const projectPath = getCurrentProjectPath();
    if (!projectPath) return;

    const entries = await fsReadDirectory(projectPath);
    sortEntries(entries);
    executeProjectTreeRefreshAction(projectPath, entries);
}

export async function renamePath(oldPath: string, nextName: string) {
    try {
        const parent = await fsDirname(oldPath);
        const newPath = await fsJoin(parent, nextName);
        await fsRename(oldPath, newPath);
        useWorkbenchStore.getState().renameTabPath(newPath, oldPath);
        useProjectStore.setState((state) => ({
            activeFile: state.activeFile === oldPath ? newPath : state.activeFile,
        }));
        await refreshProjectTree();
    } catch (error) {
        console.error('Rename failed:', error);
        executeConsoleMessageAction('editor', 'error', 'Rename failed:', String(error));
    }
}

export async function revealPathInSystem(path: string) {
    try {
        await fsOpenPath(path);
    } catch (error) {
        console.error('Reveal failed:', error);
        executeConsoleMessageAction('editor', 'error', 'Reveal failed:', String(error));
    }
}

function basename(path: string) {
    return path.split(/[\\/]/).pop() || path;
}

function makeDuplicateName(sourceName: string, existing: Set<string>): string {
    const extensionIndex = sourceName.lastIndexOf('.');
    const hasExtension = extensionIndex > 0;
    const root = hasExtension ? sourceName.slice(0, extensionIndex) : sourceName;
    const extension = hasExtension ? sourceName.slice(extensionIndex) : '';

    const first = `${root} copy${extension}`;
    if (!existing.has(first)) return first;

    let n = 2;
    while (existing.has(`${root} copy ${n}${extension}`)) {
        n += 1;
    }
    return `${root} copy ${n}${extension}`;
}

function sortEntries(entries: FsDirectoryEntry[]) {
    entries.sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        return a.name.localeCompare(b.name);
    });
}

