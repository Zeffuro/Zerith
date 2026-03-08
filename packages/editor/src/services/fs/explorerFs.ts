import { dirname, join } from '@tauri-apps/api/path';
import { type DirEntry, mkdir, readDir, readTextFile, remove, rename, writeTextFile } from '@tauri-apps/plugin-fs';
import { openPath } from '@tauri-apps/plugin-opener';

export type FsDirectoryEntry = {
    isDirectory: boolean;
    isFile: boolean;
    isSymlink: boolean;
    name: string;
};

export async function fsDirname(path: string): Promise<string> {
    return dirname(path);
}

export async function fsJoin(...parts: string[]): Promise<string> {
    return join(...parts);
}

export async function fsMkdir(path: string, recursive = true): Promise<void> {
    await mkdir(path, { recursive });
}

export async function fsOpenPath(path: string): Promise<void> {
    await openPath(path);
}

export async function fsReadDirectory(path: string): Promise<FsDirectoryEntry[]> {
    const entries = await readDir(path);
    return entries.map((entry) => mapDirectoryEntry(entry));
}

export async function fsReadTextFile(path: string): Promise<string> {
    return readTextFile(path);
}

export async function fsRemove(path: string, recursive = true): Promise<void> {
    await remove(path, { recursive });
}

export async function fsRename(oldPath: string, newPath: string): Promise<void> {
    await rename(oldPath, newPath);
}

export async function fsWriteTextFile(path: string, content: string): Promise<void> {
    await writeTextFile(path, content);
}

function mapDirectoryEntry(entry: DirEntry): FsDirectoryEntry {
    return {
        isDirectory: entry.isDirectory,
        isFile: entry.isFile,
        isSymlink: entry.isSymlink,
        name: entry.name,
    };
}

