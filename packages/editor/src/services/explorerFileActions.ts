import {
    fsReadDir,
    fsOpenPath,
    fsDirname,
    fsJoin,
    fsRename,
    fsRemove,
    fsWriteTextFile,
    fsMkdir,
} from './fs';
import { executeConsoleMessageAction } from '../store/actions/consoleMessageActions';
import { executeProjectTreeRefreshAction, getCurrentProjectPath } from '../store/actions/projectTreeActions';

function sortEntries(entries: any[]) {
    entries.sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        return a.name.localeCompare(b.name);
    });
}

export async function refreshProjectTree() {
    const projectPath = getCurrentProjectPath();
    if (!projectPath) return;

    const entries = await fsReadDir(projectPath);
    sortEntries(entries);
    executeProjectTreeRefreshAction(projectPath, entries);
}

export async function revealPathInSystem(path: string) {
    try {
        await fsOpenPath(path);
    } catch (err) {
        console.error('Reveal failed:', err);
        executeConsoleMessageAction('editor', 'error', 'Reveal failed:', String(err));
    }
}

export async function renamePath(oldPath: string, nextName: string) {
    try {
        const parent = await fsDirname(oldPath);
        const newPath = await fsJoin(parent, nextName);
        await fsRename(oldPath, newPath);
        await refreshProjectTree();
    } catch (err) {
        console.error('Rename failed:', err);
        executeConsoleMessageAction('editor', 'error', 'Rename failed:', String(err));
    }
}

export async function deletePath(path: string) {
    try {
        await fsRemove(path, true);
        await refreshProjectTree();
    } catch (err) {
        console.error('Delete failed:', err);
        executeConsoleMessageAction('editor', 'error', 'Delete failed:', String(err));
    }
}

export async function createFileInDirectory(dirPath: string, name: string, initialContent = '') {
    try {
        const full = await fsJoin(dirPath, name);
        await fsWriteTextFile(full, initialContent);
        await refreshProjectTree();
        return full;
    } catch (err) {
        console.error('Create file failed:', err);
        executeConsoleMessageAction('editor', 'error', 'Create file failed:', String(err));
        return null;
    }
}

export async function createFolderInDirectory(dirPath: string, name: string) {
    try {
        const full = await fsJoin(dirPath, name);
        await fsMkdir(full, true);
        await refreshProjectTree();
        return full;
    } catch (err) {
        console.error('Create folder failed:', err);
        executeConsoleMessageAction('editor', 'error', 'Create folder failed:', String(err));
        return null;
    }
}