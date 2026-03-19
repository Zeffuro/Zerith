import { executeConsoleMessageAction } from '../store/actions/consoleMessageActions';
import { executeProjectTreeRefreshAction, getCurrentProjectPath } from '../store/actions/projectTreeActions';
import { useProjectStore } from '../store/storeBootstrap';
import { useWorkbenchStore } from '../store/useWorkbenchStore';
import { sanitizeFileName } from '../utils/sanitizeFileName';
import {
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
        const sanitizedName = sanitizeFileName(name);
        if (!sanitizedName) {
            executeConsoleMessageAction('editor', 'warn', 'Create file aborted: invalid file name.');
            return;
        }

        if (sanitizedName !== name) {
            executeConsoleMessageAction('editor', 'warn', `File name sanitized: '${name}' -> '${sanitizedName}'`);
        }

        if (await hasSiblingWithName(directoryPath, sanitizedName)) {
            executeConsoleMessageAction('editor', 'warn', `Create file aborted: '${sanitizedName}' already exists.`);
            return;
        }

        const full = await fsJoin(directoryPath, sanitizedName);
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
        const sanitizedName = sanitizeFileName(name);
        if (!sanitizedName) {
            executeConsoleMessageAction('editor', 'warn', 'Create folder aborted: invalid folder name.');
            return;
        }

        if (sanitizedName !== name) {
            executeConsoleMessageAction('editor', 'warn', `Folder name sanitized: '${name}' -> '${sanitizedName}'`);
        }

        if (await hasSiblingWithName(directoryPath, sanitizedName)) {
            executeConsoleMessageAction('editor', 'warn', `Create folder aborted: '${sanitizedName}' already exists.`);
            return;
        }

        const full = await fsJoin(directoryPath, sanitizedName);
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

export async function deletePaths(paths: string[]): Promise<number> {
    const uniquePaths = [...new Set(paths.filter(Boolean))];
    if (uniquePaths.length === 0) return 0;

    let deletedCount = 0;

    for (const path of uniquePaths) {
        try {
            await fsRemove(path, true);
            deletedCount += 1;
        } catch (error) {
            console.error('Delete failed:', error);
            executeConsoleMessageAction('editor', 'error', `Delete failed for ${path}:`, String(error));
        }
    }

    await refreshProjectTree();
    return deletedCount;
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
    executeProjectTreeRefreshAction(projectPath, entries);
}

export async function renamePath(oldPath: string, nextName: string) {
    try {
        const parent = await fsDirname(oldPath);
        const sanitizedName = sanitizeFileName(nextName);
        if (!sanitizedName) {
            executeConsoleMessageAction('editor', 'warn', 'Rename aborted: invalid file name.');
            return;
        }

        if (sanitizedName !== nextName) {
            executeConsoleMessageAction('editor', 'warn', `Rename sanitized: '${nextName}' -> '${sanitizedName}'`);
        }

        const oldName = basename(oldPath);
        const isCaseOnlyRename = oldName.toLowerCase() === sanitizedName.toLowerCase();
        if (!isCaseOnlyRename && await hasSiblingWithName(parent, sanitizedName)) {
            executeConsoleMessageAction('editor', 'warn', `Rename aborted: '${sanitizedName}' already exists.`);
            return;
        }

        const newPath = await fsJoin(parent, sanitizedName);
        await fsRename(oldPath, newPath);
        useWorkbenchStore.getState().renameTabPath(newPath, oldPath);
        useProjectStore.setState((state) => {
            const remappedExpandedPaths = remapExpandedPathsForRename(state.expandedPaths, oldPath, newPath);

            return {
                activeFile: state.activeFile === oldPath ? newPath : state.activeFile,
                expandedPaths: remappedExpandedPaths,
            };
        });
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

async function hasSiblingWithName(directoryPath: string, candidateName: string): Promise<boolean> {
    const siblingEntries = await fsReadDirectory(directoryPath);
    const candidateLower = candidateName.toLowerCase();
    return siblingEntries.some((entry) => entry.name.toLowerCase() === candidateLower);
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

function remapExpandedPathsForRename(expandedPaths: string[], oldPath: string, newPath: string): string[] {
    const remapped = expandedPaths.map((path) => replacePathPrefix(path, oldPath, newPath));
    return [...new Set(remapped)];
}

function replacePathPrefix(path: string, oldPath: string, newPath: string): string {
    if (path === oldPath) {
        return newPath;
    }

    if (path.startsWith(`${oldPath}/`) || path.startsWith(`${oldPath}\\`)) {
        return `${newPath}${path.slice(oldPath.length)}`;
    }

    return path;
}


