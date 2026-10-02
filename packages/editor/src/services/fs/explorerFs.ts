import type { FsAdapter, FsDirectoryEntry, FsFilePickerOptions, FsImportFile, FsPickedFile, FsProjectPickerResult, FsTextWriteOptions } from './types';

import { isTauriRuntime } from '../runtime/runtimeEnvironment';
import { browserFsAdapter } from './browserFsAdapter';
import { tauriFsAdapter } from './tauriFsAdapter';

export type { FsDirectoryEntry, FsFilePickerFilter, FsFilePickerOptions, FsImportFile, FsPickedFile, FsProjectPickerResult, FsTextWriteOptions } from './types';

export async function fsCopyFileExclusive(sourcePath: string, targetPath: string): Promise<void> {
    const adapter = getFsAdapter();
    if (!adapter.copyFileExclusive) throw new Error('Path-based import is only available in the desktop editor.');
    await adapter.copyFileExclusive(sourcePath, targetPath);
}

export async function fsDirname(path: string): Promise<string> {
    return getFsAdapter().dirname(path);
}

export async function fsJoin(...parts: string[]): Promise<string> {
    return getFsAdapter().join(...parts);
}

export async function fsMkdir(path: string, recursive = true): Promise<void> {
    await getFsAdapter().mkdir(path, recursive);
}

export async function fsOpenPath(path: string): Promise<void> {
    await getFsAdapter().openPath(path);
}

export async function fsPickBinaryFiles(options?: FsFilePickerOptions): Promise<FsPickedFile[]> {
    return getFsAdapter().pickBinaryFiles(options);
}

export async function fsPickDirectory(title?: string): Promise<string | undefined> {
    return getFsAdapter().pickDirectory(title);
}

export async function fsPickImportFiles(options?: FsFilePickerOptions): Promise<FsImportFile[]> {
    const adapter = getFsAdapter();
    return adapter.pickImportFiles ? adapter.pickImportFiles(options) : adapter.pickBinaryFiles(options);
}

export async function fsPickProjectManifest(): Promise<FsProjectPickerResult | undefined> {
    return getFsAdapter().pickProjectManifest();
}

export async function fsReadBinaryFile(path: string): Promise<Uint8Array> {
    return getFsAdapter().readBinaryFile(path);
}

export async function fsReadDirectory(path: string): Promise<FsDirectoryEntry[]> {
    return getFsAdapter().readDirectory(path);
}

export async function fsReadTextFile(path: string): Promise<string> {
    return getFsAdapter().readTextFile(path);
}

export async function fsRemove(path: string, recursive = true): Promise<void> {
    await getFsAdapter().remove(path, recursive);
}

export async function fsRename(oldPath: string, newPath: string): Promise<void> {
    await getFsAdapter().rename(oldPath, newPath);
}

export async function fsWriteBinaryFile(path: string, content: Uint8Array): Promise<void> {
    await getFsAdapter().writeBinaryFile(path, content);
}

export async function fsWriteBinaryFileExclusive(path: string, content: Uint8Array): Promise<void> {
    const adapter = getFsAdapter();
    if (adapter.writeBinaryFileExclusive) {
        await adapter.writeBinaryFileExclusive(path, content);
        return;
    }
    const entries = await adapter.readDirectory(await adapter.dirname(path));
    const name = path.split(/[\\/]/u).at(-1)?.toLowerCase();
    if (entries.some((entry) => entry.name.toLowerCase() === name)) {
        throw Object.assign(new Error('Destination already exists.'), { code: 'alreadyExists' });
    }
    await adapter.writeBinaryFile(path, content);
}

export async function fsWriteTextFile(path: string, content: string, options?: FsTextWriteOptions): Promise<void> {
    await getFsAdapter().writeTextFile(path, content, options);
}

function getFsAdapter(): FsAdapter {
    return isTauriRuntime() ? tauriFsAdapter : browserFsAdapter;
}
