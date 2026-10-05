import type { FsAdapter, FsDirectoryEntry, FsFilePickerFilter } from './types';

import { moveBrowserEntry, writeBrowserFile as writeFile } from './browserDirectoryTransfer';
import { createBrowserProjectDestination } from './browserProjectDestination';
import { createBrowserProjectHandleStorage } from './browserProjectHandleStorage';
import { createBrowserProjectRegistry, validateBrowserProject } from './browserProjectRegistry';
import { basename, dirname, join, normalizeVirtualPath, pathSegments } from './pathUtilities';

export type BrowserDirectoryHandle = {
    entries: () => AsyncIterable<[string, BrowserEntryHandle]>;
    getDirectoryHandle: (name: string, options?: { create?: boolean }) => Promise<BrowserDirectoryHandle>;
    getFileHandle: (name: string, options?: { create?: boolean }) => Promise<BrowserFileHandle>;
    isSameEntry?: (other: BrowserDirectoryHandle) => Promise<boolean>;
    kind: 'directory';
    name: string;
    removeEntry: (name: string, options?: { recursive?: boolean }) => Promise<void>;
    requestPermission?: (options: { mode: 'readwrite' }) => Promise<PermissionState>;
    resolve?: (possibleDescendant: BrowserEntryHandle) => Promise<null | string[]>;
};

export type BrowserEntryHandle = BrowserDirectoryHandle | BrowserFileHandle;

export type BrowserFileHandle = {
    createWritable: () => Promise<BrowserWritableFileStream>;
    getFile: () => Promise<File>;
    kind: 'file';
    name: string;
};

export type BrowserFsAdapter = {
    clearMountedDirectories: () => void;
    finishProjectDestination: (path: string) => Promise<void>;
    getDirectoryHandle: (path: string) => Promise<BrowserDirectoryHandle>;
    isSupported: () => boolean;
    mountDirectory: (handle: BrowserDirectoryHandle) => string;
    prepareProject: (manifestPath: string) => Promise<void>;
    recentProjects: ReturnType<typeof createBrowserProjectRegistry>;
    reserveProjectDestination: (path: string, sourcePath?: string) => Promise<string>;
} & FsAdapter;

export type BrowserFsGlobal = {
    showDirectoryPicker?: (options?: { mode?: 'read' | 'readwrite' }) => Promise<BrowserDirectoryHandle>;
    showOpenFilePicker?: (options?: BrowserOpenFilePickerOptions) => Promise<BrowserFileHandle[]>;
} & typeof globalThis;

export type BrowserOpenFilePickerOptions = {
    multiple?: boolean;
    types?: BrowserOpenFilePickerType[];
};

export type BrowserOpenFilePickerType = {
    accept: Record<string, string[]>;
    description: string;
};

export type BrowserWritableFileStream = {
    abort?: () => Promise<void>;
    close: () => Promise<void>;
    write: (data: ArrayBuffer | Blob | string | Uint8Array) => Promise<void>;
};

export function createBrowserFsAdapter(browserGlobal: BrowserFsGlobal = globalThis): BrowserFsAdapter {
    const roots = new Map<string, BrowserDirectoryHandle>();
    const destinations = createBrowserProjectDestination(roots);
    const recentProjects = createBrowserProjectRegistry(createBrowserProjectHandleStorage(browserGlobal.indexedDB), {
        get: path => roots.get(path.slice(1)),
        mount: (handle, path) => {
            const existing = roots.get(path.slice(1));
            if (existing && existing !== handle) {
                throw new Error('This folder path is already in use. Reopen the project folder.');
            }
            roots.set(path.slice(1), handle);
        },
        mounted: function* () {
            for (const [name, handle] of roots) yield [`/${name}`, handle] as [string, BrowserDirectoryHandle];
        },
    });

    const adapter: BrowserFsAdapter = {
        clearMountedDirectories: () => {
            roots.clear();
        },
        dirname: (path) => Promise.resolve(dirname(path)),
        finishProjectDestination: destinations.finish,
        getDirectoryHandle: path => resolveDirectory(path, roots),
        isSupported: () => typeof browserGlobal.showDirectoryPicker === 'function',
        join: (...parts) => Promise.resolve(join(...parts)),
        mkdir: async (path, recursive = true) => {
            const normalizedPath = normalizeVirtualPath(path);
            const segments = pathSegments(normalizedPath);
            if (segments.length === 0) return;

            const root = getMountedRoot(segments[0], roots);
            let current = root;
            for (const segment of segments.slice(1)) {
                current = await current.getDirectoryHandle(segment, { create: recursive });
            }
        },
        mountDirectory: (handle) => mountDirectory(handle, roots),
        openPath: () => Promise.reject(new Error('Reveal in system is only available in the desktop editor.')),
        pickBinaryFiles: async (options = {}) => {
            const handles = await pickBinaryFiles(browserGlobal, options.filters, options.multiple ?? true);
            return Promise.all(handles.map(async (handle) => {
                const file = await handle.getFile();
                return {
                    bytes: new Uint8Array(await file.arrayBuffer()),
                    name: file.name || handle.name,
                };
            }));
        },
        pickDirectory: async () => {
            const directory = await pickDirectory(browserGlobal, adapter);
            return directory ? recentProjects.mountPicked(directory) : undefined;
        },
        pickProjectManifest: async () => {
            const directory = await pickDirectory(browserGlobal, adapter);
            if (!directory) return;
            const projectPath = await recentProjects.mountPicked(directory);
            await directory.getFileHandle('game.json');
            return {
                manifestPath: join(projectPath, 'game.json'),
                projectPath,
            };
        },
        prepareProject: async (manifestPath) => {
            if (basename(manifestPath) !== 'game.json') throw new Error('Select a project game.json.');
            await validateBrowserProject(await resolveDirectory(dirname(manifestPath), roots));
        },
        readBinaryFile: async (path) => {
            const fileHandle = await resolveFile(path, roots);
            const file = await fileHandle.getFile();
            return new Uint8Array(await file.arrayBuffer());
        },
        readDirectory: async (path) => {
            const directory = await resolveDirectory(path, roots);
            const entries: FsDirectoryEntry[] = [];

            for await (const [name, handle] of directory.entries()) {
                entries.push({
                    isDirectory: handle.kind === 'directory',
                    isFile: handle.kind === 'file',
                    isSymlink: false,
                    name,
                });
            }

            return entries;
        },
        readTextFile: async (path) => {
            const fileHandle = await resolveFile(path, roots);
            const file = await fileHandle.getFile();
            return file.text();
        },
        recentProjects,
        remove: async (path, recursive = true) => {
            const { entryName, parent } = await resolveParentDirectory(path, roots);
            await parent.removeEntry(entryName, { recursive });
        },
        rename: async (oldPath, newPath) => {
            const sourcePath = `/${pathSegments(oldPath).join('/')}`;
            const destinationPath = `/${pathSegments(newPath).join('/')}`;
            if ([...pathSegments(sourcePath), ...pathSegments(destinationPath)].some(segment => segment === '.' || segment === '..')) {
                throw new Error('Move paths cannot contain traversal segments.');
            }
            const source = await resolveParentDirectory(sourcePath, roots);
            const destination = await resolveParentDirectory(destinationPath, roots);
            await moveBrowserEntry(source, destination, sourcePath, destinationPath);
        },
        reserveProjectDestination: destinations.reserve,
        writeBinaryFile: async (path, content) => {
            const file = await getWritableFile(path, roots);
            await writeFile(file, content);
        },
        writeBinaryFileExclusive: destinations.writeExclusive,
        writeTextFile: async (path, content, options) => {
            if (options?.createOnly) {
                await destinations.writeExclusive(path, content);
                return;
            }
            if (options?.expectedContent !== undefined && await adapter.readTextFile(path) !== options.expectedContent) {
                throw new Error('File changed on disk. Reopen it before saving.');
            }
            const file = await getWritableFile(path, roots);
            await writeFile(file, content);
        },
    };

    return adapter;
}

export const browserFsAdapter = createBrowserFsAdapter();

function getMountedRoot(rootName: string | undefined, roots: Map<string, BrowserDirectoryHandle>): BrowserDirectoryHandle {
    if (!rootName) {
        throw new Error('Browser filesystem path is missing a mounted root.');
    }

    const root = roots.get(rootName);
    if (!root) {
        throw new Error(`Browser filesystem root "${rootName}" is not mounted. Reopen the project folder.`);
    }
    return root;
}

async function getWritableFile(path: string, roots: Map<string, BrowserDirectoryHandle>): Promise<BrowserFileHandle> {
    const { entryName, parent } = await resolveParentDirectory(path, roots);
    return parent.getFileHandle(entryName, { create: true });
}

function mimeForPickerFilter(filter: FsFilePickerFilter): string {
    const extensions = new Set(filter.extensions.map((extension) => extension.replace(/^\./u, '').toLowerCase()));

    if ([...extensions].every((extension) => IMAGE_PICKER_EXTENSIONS.has(extension))) return 'image/*';
    if ([...extensions].every((extension) => AUDIO_PICKER_EXTENSIONS.has(extension))) return 'audio/*';
    if ([...extensions].every((extension) => FONT_PICKER_EXTENSIONS.has(extension))) return 'font/*';
    if ([...extensions].every((extension) => TEXT_PICKER_EXTENSIONS.has(extension))) return 'text/*';

    return 'application/octet-stream';
}

function mountDirectory(handle: BrowserDirectoryHandle, roots: Map<string, BrowserDirectoryHandle>): string {
    for (const [rootName, rootHandle] of roots) {
        if (rootHandle === handle) {
            return `/${rootName}`;
        }
    }

    const baseName = sanitizeRootName(handle.name || 'browser-project');
    let rootName = baseName;
    let index = 2;
    while (roots.has(rootName)) {
        rootName = `${baseName}-${index}`;
        index += 1;
    }

    roots.set(rootName, handle);
    return `/${rootName}`;
}

async function pickBinaryFiles(
    browserGlobal: BrowserFsGlobal,
    filters: FsFilePickerFilter[] | undefined,
    multiple: boolean,
): Promise<BrowserFileHandle[]> {
    if (typeof browserGlobal.showOpenFilePicker !== 'function') {
        throw new TypeError('This browser does not support file import. Use Chrome or Edge.');
    }

    try {
        return await browserGlobal.showOpenFilePicker({
            multiple,
            types: toBrowserPickerTypes(filters),
        });
    } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
            return [];
        }
        throw error;
    }
}

async function pickDirectory(
    browserGlobal: BrowserFsGlobal,
    adapter: BrowserFsAdapter,
): Promise<BrowserDirectoryHandle | undefined> {
    if (!adapter.isSupported() || !browserGlobal.showDirectoryPicker) {
        throw new Error('This browser does not support the File System Access API. Use Chrome or Edge.');
    }

    try {
        return await browserGlobal.showDirectoryPicker({ mode: 'readwrite' });
    } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
            return;
        }
        throw error;
    }
}

async function resolveDirectory(
    path: string,
    roots: Map<string, BrowserDirectoryHandle>,
): Promise<BrowserDirectoryHandle> {
    const segments = pathSegments(path);
    const root = getMountedRoot(segments[0], roots);
    let current = root;

    for (const segment of segments.slice(1)) {
        current = await current.getDirectoryHandle(segment);
    }

    return current;
}

async function resolveFile(path: string, roots: Map<string, BrowserDirectoryHandle>): Promise<BrowserFileHandle> {
    const { entryName, parent } = await resolveParentDirectory(path, roots);
    return parent.getFileHandle(entryName);
}

async function resolveParentDirectory(
    path: string,
    roots: Map<string, BrowserDirectoryHandle>,
): Promise<{ entryName: string; parent: BrowserDirectoryHandle }> {
    const entryName = basename(path);
    const parentPath = dirname(path);
    return {
        entryName,
        parent: await resolveDirectory(parentPath, roots),
    };
}

function sanitizeRootName(name: string): string {
    const sanitized = name.replaceAll(/[^\w.-]+/gu, '-').replaceAll(/^-|-$/gu, '');
    return sanitized || 'browser-project';
}

function toBrowserPickerTypes(filters: FsFilePickerFilter[] | undefined): BrowserOpenFilePickerType[] | undefined {
    if (!filters || filters.length === 0) return undefined;

    return filters.map((filter) => ({
        accept: {
            [mimeForPickerFilter(filter)]: filter.extensions.map((extension) => extension.startsWith('.') ? extension : `.${extension}`),
        },
        description: filter.name,
    }));
}

const AUDIO_PICKER_EXTENSIONS = new Set(['m4a', 'mp3', 'ogg', 'wav']);
const FONT_PICKER_EXTENSIONS = new Set(['otf', 'ttf', 'woff', 'woff2']);
const IMAGE_PICKER_EXTENSIONS = new Set(['avif', 'jpeg', 'jpg', 'png', 'svg', 'webp']);
const TEXT_PICKER_EXTENSIONS = new Set(['css', 'csv', 'html', 'ini', 'js', 'jsx', 'md', 'toml', 'ts', 'tsx', 'txt', 'yaml', 'yml']);
