import { remove, rename, mkdir, writeTextFile, readDir } from '@tauri-apps/plugin-fs';
import { openPath } from '@tauri-apps/plugin-opener';
import { dirname, join } from '@tauri-apps/api/path';
import { useProjectStore } from '../store/useProjectStore';
import { useConsoleStore } from '../store/useConsoleStore';

function sortEntries(entries: any[]) {
    entries.sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        return a.name.localeCompare(b.name);
    });
}

export async function refreshProjectTree() {
    const projectPath = useProjectStore.getState().projectPath;
    if (!projectPath) return;

    const entries = await readDir(projectPath);
    sortEntries(entries);
    useProjectStore.getState().setProject(projectPath, entries);
    useProjectStore.getState().bumpTreeRevision?.();
}

export async function revealPathInSystem(path: string) {
    try {
        await openPath(path);
    } catch (err) {
        console.error('Reveal failed:', err);
        useConsoleStore.getState().addMessage('editor', 'error', 'Reveal failed:', String(err));
    }
}

export async function renamePath(oldPath: string, nextName: string) {
    try {
        const parent = await dirname(oldPath);
        const newPath = await join(parent, nextName);
        await rename(oldPath, newPath);
        await refreshProjectTree();
    } catch (err) {
        console.error('Rename failed:', err);
        useConsoleStore.getState().addMessage('editor', 'error', 'Rename failed:', String(err));
    }
}

export async function deletePath(path: string) {
    try {
        await remove(path, { recursive: true });
        await refreshProjectTree();
    } catch (err) {
        console.error('Delete failed:', err);
        useConsoleStore.getState().addMessage('editor', 'error', 'Delete failed:', String(err));
    }
}

export async function createFileInDirectory(dirPath: string, name: string, initialContent = '') {
    try {
        const full = await join(dirPath, name);
        await writeTextFile(full, initialContent);
        await refreshProjectTree();
        return full;
    } catch (err) {
        console.error('Create file failed:', err);
        useConsoleStore.getState().addMessage('editor', 'error', 'Create file failed:', String(err));
        return null;
    }
}

export async function createFolderInDirectory(dirPath: string, name: string) {
    try {
        const full = await join(dirPath, name);
        await mkdir(full, { recursive: true });
        await refreshProjectTree();
        return full;
    } catch (err) {
        console.error('Create folder failed:', err);
        useConsoleStore.getState().addMessage('editor', 'error', 'Create folder failed:', String(err));
        return null;
    }
}