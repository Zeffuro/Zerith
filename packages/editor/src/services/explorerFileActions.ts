import { executeConsoleMessageAction } from '../store/actions/consoleMessageActions';
import { executeProjectTreeRefreshAction, getCurrentProjectPath } from '../store/actions/projectTreeActions';
import {
    fsDirname,
    fsJoin,
    fsMkdir,
    fsOpenPath,
    fsReadDir,
    fsRemove,
    fsRename,
    fsWriteTextFile,
} from './fs';

export async function createFileInDirectory(dirPath: string, name: string, initialContent = '') {
    try {
        const full = await fsJoin(dirPath, name);
        await fsWriteTextFile(full, initialContent);
        await refreshProjectTree();
        return full;
    } catch (error) {
        console.error('Create file failed:', error);
        executeConsoleMessageAction('editor', 'error', 'Create file failed:', String(error));
        return null;
    }
}

export async function createFolderInDirectory(dirPath: string, name: string) {
    try {
        const full = await fsJoin(dirPath, name);
        await fsMkdir(full, true);
        await refreshProjectTree();
        return full;
    } catch (error) {
        console.error('Create folder failed:', error);
        executeConsoleMessageAction('editor', 'error', 'Create folder failed:', String(error));
        return null;
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

export async function refreshProjectTree() {
    const projectPath = getCurrentProjectPath();
    if (!projectPath) return;

    const entries = await fsReadDir(projectPath);
    sortEntries(entries);
    executeProjectTreeRefreshAction(projectPath, entries);
}

export async function renamePath(oldPath: string, nextName: string) {
    try {
        const parent = await fsDirname(oldPath);
        const newPath = await fsJoin(parent, nextName);
        await fsRename(oldPath, newPath);
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

function sortEntries(entries: any[]) {
    entries.sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        return a.name.localeCompare(b.name);
    });
}