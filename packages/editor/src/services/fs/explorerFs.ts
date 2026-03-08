import { readDir, readTextFile, remove, rename, mkdir, writeTextFile, type DirEntry } from '@tauri-apps/plugin-fs';
import { openPath } from '@tauri-apps/plugin-opener';
import { dirname, join } from '@tauri-apps/api/path';

export async function fsReadDir(path: string): Promise<DirEntry[]> {
    return readDir(path);
}

export async function fsReadTextFile(path: string): Promise<string> {
    return readTextFile(path);
}

export async function fsOpenPath(path: string): Promise<void> {
    await openPath(path);
}

export async function fsDirname(path: string): Promise<string> {
    return dirname(path);
}

export async function fsJoin(...parts: string[]): Promise<string> {
    return join(...parts);
}

export async function fsRename(oldPath: string, newPath: string): Promise<void> {
    await rename(oldPath, newPath);
}

export async function fsRemove(path: string, recursive = true): Promise<void> {
    await remove(path, { recursive });
}

export async function fsWriteTextFile(path: string, content: string): Promise<void> {
    await writeTextFile(path, content);
}

export async function fsMkdir(path: string, recursive = true): Promise<void> {
    await mkdir(path, { recursive });
}

