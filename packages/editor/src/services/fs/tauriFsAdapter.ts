import type { DirEntry } from '@tauri-apps/plugin-fs';

import type { FsAdapter, FsDirectoryEntry } from './types';

let pathApiPromise: Promise<typeof import('@tauri-apps/api/path')> | undefined;
let dialogApiPromise: Promise<typeof import('@tauri-apps/plugin-dialog')> | undefined;
let fsApiPromise: Promise<typeof import('@tauri-apps/plugin-fs')> | undefined;
let openerApiPromise: Promise<typeof import('@tauri-apps/plugin-opener')> | undefined;

export const tauriFsAdapter: FsAdapter = {
    dirname: async (path) => {
        const pathApi = await getPathApi();
        return pathApi.dirname(path);
    },
    join: async (...parts) => {
        const pathApi = await getPathApi();
        return pathApi.join(...parts);
    },
    mkdir: async (path, recursive = true) => {
        const fsApi = await getFsApi();
        await fsApi.mkdir(path, { recursive });
    },
    openPath: async (path) => {
        const openerApi = await getOpenerApi();
        await openerApi.openPath(path);
    },
    pickDirectory: async (title = 'Select directory') => {
        const dialogApi = await getDialogApi();
        const selectedDirectory = await dialogApi.open({
            directory: true,
            multiple: false,
            title,
        });

        return typeof selectedDirectory === 'string' ? selectedDirectory : undefined;
    },
    pickProjectManifest: async () => {
        const dialogApi = await getDialogApi();
        const selectedFile = await dialogApi.open({
            directory: false,
            filters: [{ extensions: ['json'], name: 'Game Manifest' }],
            multiple: false,
            title: 'Select game.json',
        });

        if (typeof selectedFile !== 'string') {
            return;
        }

        return {
            manifestPath: selectedFile,
            projectPath: await tauriFsAdapter.dirname(selectedFile),
        };
    },
    readBinaryFile: async (path) => {
        const fsApi = await getFsApi();
        return fsApi.readFile(path);
    },
    readDirectory: async (path) => {
        const fsApi = await getFsApi();
        const entries = await fsApi.readDir(path);
        return entries.map((entry) => mapDirectoryEntry(entry));
    },
    readTextFile: async (path) => {
        const fsApi = await getFsApi();
        return fsApi.readTextFile(path);
    },
    remove: async (path, recursive = true) => {
        const fsApi = await getFsApi();
        await fsApi.remove(path, { recursive });
    },
    rename: async (oldPath, newPath) => {
        const fsApi = await getFsApi();
        await fsApi.rename(oldPath, newPath);
    },
    writeBinaryFile: async (path, content) => {
        const fsApi = await getFsApi();
        await fsApi.writeFile(path, content);
    },
    writeTextFile: async (path, content) => {
        const fsApi = await getFsApi();
        await fsApi.writeTextFile(path, content);
    },
};

async function getDialogApi(): Promise<typeof import('@tauri-apps/plugin-dialog')> {
    dialogApiPromise ??= import('@tauri-apps/plugin-dialog');
    return dialogApiPromise;
}

async function getFsApi(): Promise<typeof import('@tauri-apps/plugin-fs')> {
    fsApiPromise ??= import('@tauri-apps/plugin-fs');
    return fsApiPromise;
}

async function getOpenerApi(): Promise<typeof import('@tauri-apps/plugin-opener')> {
    openerApiPromise ??= import('@tauri-apps/plugin-opener');
    return openerApiPromise;
}

async function getPathApi(): Promise<typeof import('@tauri-apps/api/path')> {
    pathApiPromise ??= import('@tauri-apps/api/path');
    return pathApiPromise;
}

function mapDirectoryEntry(entry: DirEntry): FsDirectoryEntry {
    return {
        isDirectory: entry.isDirectory,
        isFile: entry.isFile,
        isSymlink: entry.isSymlink,
        name: entry.name,
    };
}
