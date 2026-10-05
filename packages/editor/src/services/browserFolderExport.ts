import type { BrowserDirectoryHandle, BrowserFsGlobal } from './fs/browserFsAdapter';

import { writeBrowserFile } from './fs/browserDirectoryTransfer';

export type BrowserFolderExportTarget = {
    folderName: string;
    parent: BrowserDirectoryHandle;
};

export async function pickBrowserFolderExportTarget(folderName: string): Promise<BrowserFolderExportTarget | undefined> {
    const validatedName = validateComponent(folderName.trim());
    const browserGlobal = globalThis as BrowserFsGlobal;
    if (!browserGlobal.showDirectoryPicker) throw new Error('Folder export is not supported in this browser.');
    try {
        const parent = await browserGlobal.showDirectoryPicker({ mode: 'readwrite' });
        return { folderName: validatedName, parent };
    } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        throw error;
    }
}

export async function writeBrowserFolderExport(
    target: BrowserFolderExportTarget,
    files: Record<string, Uint8Array>,
    source: BrowserDirectoryHandle,
): Promise<string> {
    const folderName = validateComponent(target.folderName.trim());
    const artifacts = validateArtifacts(files);
    if (!source.resolve) throw new Error('Cannot verify the export folder is outside the project. Choose a browser with folder ancestry support.');
    if (await source.resolve(target.parent) !== null) {
        throw new Error('Choose an export parent folder outside the source project folder.');
    }
    await rejectExistingEntry(target.parent, folderName);

    const location = `${target.parent.name}/${folderName}`;
    let reserved = false;
    try {
        const output = await target.parent.getDirectoryHandle(folderName, { create: true });
        reserved = true;
        await requireEmptyDirectory(output);
        const directories = new Map<string, BrowserDirectoryHandle>([['', output]]);
        for (const { bytes, segments } of artifacts) {
            let parent = output;
            for (let index = 0; index < segments.length - 1; index++) {
                const name = segments[index];
                const path = segments.slice(0, index + 1).join('/');
                let directory = directories.get(path);
                if (!directory) {
                    await rejectExistingEntry(parent, name);
                    directory = await parent.getDirectoryHandle(name, { create: true });
                    await requireEmptyDirectory(directory);
                    directories.set(path, directory);
                }
                parent = directory;
            }
            const filename = segments.at(-1)!;
            await rejectExistingEntry(parent, filename);
            const file = await parent.getFileHandle(filename, { create: true });
            await writeBrowserFile(file, bytes);
        }
        return location;
    } catch (error) {
        if (!reserved) throw error;
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Export failed: ${message}. Partial export remains at ${location}. Choose a new folder name to retry.`, { cause: error });
    }
}

async function rejectExistingEntry(parent: BrowserDirectoryHandle, entryName: string): Promise<void> {
    for await (const [name] of parent.entries()) {
        if (name.toLowerCase() === entryName.toLowerCase()) {
            throw new Error(`Export destination already exists: ${entryName}. Choose a new folder name.`);
        }
    }
}

async function requireEmptyDirectory(directory: BrowserDirectoryHandle): Promise<void> {
    for await (const [name] of directory.entries()) {
        throw new Error(`Export directory is no longer empty: ${directory.name}/${name}.`);
    }
}

function validateArtifacts(files: Record<string, Uint8Array>): { bytes: Uint8Array; segments: string[] }[] {
    const entries = new Map<string, { kind: 'directory' | 'file'; path: string }>();
    return Object.entries(files).map(([path, bytes]) => {
        const segments = path.split('/');
        for (let index = 0; index < segments.length; index++) {
            validateComponent(segments[index]);
            const entryPath = segments.slice(0, index + 1).join('/');
            const kind = index === segments.length - 1 ? 'file' : 'directory';
            const key = entryPath.toLowerCase();
            const existing = entries.get(key);
            if (existing && (existing.path !== entryPath || existing.kind !== kind)) {
                throw new Error(`Export paths collide: "${existing.path}" and "${entryPath}".`);
            }
            entries.set(key, { kind, path: entryPath });
        }
        return { bytes, segments };
    });
}

function validateComponent(name: string): string {
    if (!name || name !== name.trim() || name === '.' || name === '..'
        || /[<>:"/\\|?*]/u.test(name)
        || [...name].some(character => {
            const code = character.codePointAt(0)!;
            return code < 32 || (code >= 127 && code <= 159);
        })
        || /[. ]$/u.test(name)
        || /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/iu.test(name)) {
        throw new Error(`Invalid export name: "${name}". Use a single portable folder or file name.`);
    }
    return name;
}
