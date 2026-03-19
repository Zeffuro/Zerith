import { open as openDialog } from '@tauri-apps/plugin-dialog';

import { fsJoin, fsMkdir, fsReadBinaryFile, fsReadDirectory, fsWriteBinaryFile } from './fs';

const MANIFEST_FILE_NAME = 'game.json';

export type SaveProjectAsResult = {
    manifestPath: string;
    projectPath: string;
};

type SaveProjectAsDependencies = {
    fsJoin: (...parts: string[]) => Promise<string>;
    fsMkdir: (path: string, recursive?: boolean) => Promise<void>;
    fsReadBinaryFile: (path: string) => Promise<Uint8Array>;
    fsReadDirectory: typeof fsReadDirectory;
    fsWriteBinaryFile: (path: string, content: Uint8Array) => Promise<void>;
    pickTargetDirectory: () => Promise<string | undefined>;
};

const defaultDependencies: SaveProjectAsDependencies = {
    fsJoin,
    fsMkdir,
    fsReadBinaryFile,
    fsReadDirectory,
    fsWriteBinaryFile,
    pickTargetDirectory: async () => {
        const selectedDirectory = await openDialog({
            directory: true,
            multiple: false,
            title: 'Save Project As...',
        });

        return typeof selectedDirectory === 'string' ? selectedDirectory : undefined;
    },
};

export async function saveProjectAs(
    currentProjectPath: string,
    dependencies: SaveProjectAsDependencies = defaultDependencies,
): Promise<SaveProjectAsResult | undefined> {
    const sourcePath = currentProjectPath.trim();
    if (!sourcePath) {
        throw new Error('Current project path is required.');
    }

    const selectedDirectory = await dependencies.pickTargetDirectory();
    if (!selectedDirectory) {
        return;
    }

    const targetPath = selectedDirectory.trim();
    if (!targetPath) {
        return;
    }

    if (pathsEqual(sourcePath, targetPath)) {
        throw new Error('Save Project As target must be different from the current project folder.');
    }

    if (pathsOverlap(sourcePath, targetPath)) {
        throw new Error('Save Project As target cannot be nested within the current project folder.');
    }

    await copyDirectoryRecursive(sourcePath, targetPath, dependencies);

    return {
        manifestPath: await dependencies.fsJoin(targetPath, MANIFEST_FILE_NAME),
        projectPath: targetPath,
    };
}

async function copyDirectoryRecursive(
    sourcePath: string,
    targetPath: string,
    dependencies: SaveProjectAsDependencies,
): Promise<void> {
    await dependencies.fsMkdir(targetPath, true);

    const entries = await dependencies.fsReadDirectory(sourcePath);
    for (const entry of entries) {
        const sourceEntryPath = await dependencies.fsJoin(sourcePath, entry.name);
        const targetEntryPath = await dependencies.fsJoin(targetPath, entry.name);

        if (entry.isDirectory) {
            await copyDirectoryRecursive(sourceEntryPath, targetEntryPath, dependencies);
            continue;
        }

        const content = await dependencies.fsReadBinaryFile(sourceEntryPath);
        await dependencies.fsWriteBinaryFile(targetEntryPath, content);
    }
}

function normalizePath(path: string): string {
    return path.replaceAll('\\', '/').replace(/\/+$/u, '').toLowerCase();
}

function pathsEqual(left: string, right: string): boolean {
    return normalizePath(left) === normalizePath(right);
}

function pathsOverlap(sourcePath: string, targetPath: string): boolean {
    const normalizedSource = normalizePath(sourcePath);
    const normalizedTarget = normalizePath(targetPath);
    return normalizedTarget.startsWith(`${normalizedSource}/`);
}

