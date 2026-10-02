import type { BrowserDirectoryHandle, BrowserEntryHandle, BrowserFileHandle } from './browserFsAdapter';

type EntryLocation = { entryName: string; parent: BrowserDirectoryHandle };
type SourceSnapshot = Map<string, { kind: 'directory' | 'file'; lastModified?: number; size?: number }>;

export async function moveBrowserEntry(
    source: EntryLocation,
    destination: EntryLocation,
    oldPath: string,
    newPath: string,
): Promise<void> {
    const entry = await resolveEntry(source);
    if (oldPath === newPath) return;
    if (newPath.startsWith(`${oldPath}/`)
        || (entry.kind === 'directory' && entry.resolve && await entry.resolve(destination.parent) !== null)) {
        throw new Error('Cannot move a folder into itself or one of its descendants.');
    }
    await rejectExistingDestination(destination);

    const snapshot: SourceSnapshot = new Map();
    let destinationCreated = false;
    try {
        if (entry.kind === 'directory') {
            const target = await destination.parent.getDirectoryHandle(destination.entryName, { create: true });
            destinationCreated = true;
            await copyDirectory(entry, target, '', snapshot);
        } else {
            const file = await entry.getFile();
            snapshot.set('', fileSnapshot(file));
            const target = await destination.parent.getFileHandle(destination.entryName, { create: true });
            destinationCreated = true;
            await writeBrowserFile(target, file);
        }
        await verifySource(await resolveEntry(source), '', snapshot);
        if (snapshot.size > 0) throw new Error('Source entries changed while copying.');
    } catch (error) {
        if (!destinationCreated) throw error;
        throw new Error(`Move failed: ${errorMessage(error)}. Source remains at ${oldPath}; partial destination remains at ${newPath}.`, { cause: error });
    }

    try {
        await source.parent.removeEntry(source.entryName, { recursive: entry.kind === 'directory' });
    } catch (error) {
        throw new Error(`Move failed: ${errorMessage(error)}. Destination remains at ${newPath}; source removal is incomplete at ${oldPath}.`, { cause: error });
    }
}

export async function writeBrowserFile(file: BrowserFileHandle, content: ArrayBuffer | Blob | string | Uint8Array): Promise<void> {
    const writable = await file.createWritable();
    try {
        await writable.write(content);
        await writable.close();
    } catch (error) {
        try {
            await writable.abort?.();
        } catch {
            // Preserve the write error if abort also fails.
        }
        throw error;
    }
}

async function copyDirectory(
    source: BrowserDirectoryHandle,
    target: BrowserDirectoryHandle,
    path: string,
    snapshot: SourceSnapshot,
): Promise<void> {
    snapshot.set(path, { kind: 'directory' });
    for await (const [name, handle] of source.entries()) {
        const childPath = `${path}/${name}`;
        await rejectExistingDestination({ entryName: name, parent: target });
        if (handle.kind === 'directory') {
            const directory = await target.getDirectoryHandle(name, { create: true });
            await copyDirectory(handle, directory, childPath, snapshot);
        } else {
            const file = await handle.getFile();
            snapshot.set(childPath, fileSnapshot(file));
            const targetFile = await target.getFileHandle(name, { create: true });
            await writeBrowserFile(targetFile, file);
        }
    }
}

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

function fileSnapshot(file: File): { kind: 'file'; lastModified: number; size: number } {
    return { kind: 'file', lastModified: file.lastModified, size: file.size };
}

async function rejectExistingDestination({ entryName, parent }: EntryLocation): Promise<void> {
    for await (const [name] of parent.entries()) {
        if (name.toLowerCase() === entryName.toLowerCase()) {
            throw Object.assign(new Error(`Destination already exists: ${entryName}`), { code: 'alreadyExists' });
        }
    }
}

async function resolveEntry({ entryName, parent }: EntryLocation): Promise<BrowserEntryHandle> {
    try {
        return await parent.getFileHandle(entryName);
    } catch (error) {
        if (!(error instanceof DOMException) || error.name !== 'TypeMismatchError') throw error;
        return parent.getDirectoryHandle(entryName);
    }
}

async function verifySource(entry: BrowserEntryHandle, path: string, snapshot: SourceSnapshot): Promise<void> {
    const expected = snapshot.get(path);
    if (!expected || expected.kind !== entry.kind) throw new Error('Source entries changed while copying.');
    snapshot.delete(path);
    if (entry.kind === 'directory') {
        for await (const [name, child] of entry.entries()) {
            await verifySource(child, `${path}/${name}`, snapshot);
        }
    } else {
        const file = await entry.getFile();
        if (file.lastModified !== expected.lastModified || file.size !== expected.size) {
            throw new Error('Source file changed while copying.');
        }
    }
}
