import type { FsDirectoryEntry } from '../services/fs';
import type { EditorPluginPackageIntegrityFile, EditorPluginSourceRecord } from './pluginManifestInspection';

import {
    fsJoin,
    fsMkdir,
    fsReadBinaryFile,
    fsReadDirectory,
    fsWriteBinaryFile,
    fsWriteTextFile,
} from '../services/fs';
import { serializeEditorPluginSourceRecord } from './pluginManifestInspection';
import { createEditorPluginPackageIntegrityFile } from './pluginPackageIntegrity';

export type EditorPluginPackageInstallDependencies = {
    join: (...parts: string[]) => Promise<string>;
    mkdir: (path: string, recursive?: boolean) => Promise<void>;
    readBinaryFile: (path: string) => Promise<Uint8Array>;
    readDirectory: (path: string) => Promise<FsDirectoryEntry[]>;
    writeBinaryFile: (path: string, content: Uint8Array) => Promise<void>;
    writeTextFile: (path: string, content: string) => Promise<void>;
};

export type EditorPluginPackageInstallOptions = {
    dependencies?: Partial<EditorPluginPackageInstallDependencies>;
    installRoot?: string;
    overwrite?: boolean;
};

export type EditorPluginPackageInstallResult = {
    copiedFiles: string[];
    recordPath: string;
    skippedEntries: string[];
    status: 'installed';
    targetPath: string;
};

const DEFAULT_DEPENDENCIES: EditorPluginPackageInstallDependencies = {
    join: fsJoin,
    mkdir: fsMkdir,
    readBinaryFile: fsReadBinaryFile,
    readDirectory: fsReadDirectory,
    writeBinaryFile: fsWriteBinaryFile,
    writeTextFile: fsWriteTextFile,
};

const SKIPPED_PACKAGE_DIRECTORIES = new Set(['.git', 'node_modules']);
const SOURCE_RECORD_FILE_NAME = 'zerith.editorPluginSource.json';

export async function installEditorPluginSourceRecord(
    record: EditorPluginSourceRecord,
    options: EditorPluginPackageInstallOptions = {},
): Promise<EditorPluginPackageInstallResult> {
    if (!record.packageRoot) {
        throw new Error('Plugin source record is missing packageRoot metadata.');
    }

    const dependencies = { ...DEFAULT_DEPENDENCIES, ...options.dependencies };
    const targetPath = await resolveInstallTargetPath(record, dependencies, options.installRoot);
    assertTargetOutsideSource(record.packageRoot, targetPath);

    await assertTargetIsWritable(targetPath, dependencies, options.overwrite ?? false);
    await dependencies.mkdir(targetPath, true);

    const copiedFiles: string[] = [];
    const integrityFiles: EditorPluginPackageIntegrityFile[] = [];
    const skippedEntries: string[] = [];
    await copyPluginPackageDirectory(record.packageRoot, targetPath, '', dependencies, copiedFiles, integrityFiles, skippedEntries);

    const recordPath = await dependencies.join(targetPath, SOURCE_RECORD_FILE_NAME);
    await dependencies.writeTextFile(recordPath, serializeEditorPluginSourceRecord({
        ...record,
        install: {
            ...record.install,
            targetPath,
        },
        packageIntegrity: {
            algorithm: 'sha256',
            files: integrityFiles.toSorted((left, right) => left.path.localeCompare(right.path)),
        },
    }));

    return {
        copiedFiles: copiedFiles.toSorted((left, right) => left.localeCompare(right)),
        recordPath,
        skippedEntries: skippedEntries.toSorted((left, right) => left.localeCompare(right)),
        status: 'installed',
        targetPath,
    };
}

async function assertTargetIsWritable(
    targetPath: string,
    dependencies: EditorPluginPackageInstallDependencies,
    overwrite: boolean,
): Promise<void> {
    if (overwrite) return;

    let entries: FsDirectoryEntry[];
    try {
        entries = await dependencies.readDirectory(targetPath);
    } catch {
        return;
    }

    if (entries.length > 0) {
        throw new Error(`Plugin install target is not empty: ${targetPath}`);
    }
}

function assertTargetOutsideSource(packageRoot: string, targetPath: string): void {
    const source = normalizeComparablePath(packageRoot);
    const target = normalizeComparablePath(targetPath);
    if (source === target || target.startsWith(`${source}/`)) {
        throw new Error('Plugin install target cannot be inside the source package.');
    }
}

async function copyPluginPackageDirectory(
    sourceDirectory: string,
    targetDirectory: string,
    relativeDirectory: string,
    dependencies: EditorPluginPackageInstallDependencies,
    copiedFiles: string[],
    integrityFiles: EditorPluginPackageIntegrityFile[],
    skippedEntries: string[],
): Promise<void> {
    const entries = await dependencies.readDirectory(sourceDirectory);
    await dependencies.mkdir(targetDirectory, true);

    for (const entry of entries) {
        const sourcePath = await dependencies.join(sourceDirectory, entry.name);
        const targetPath = await dependencies.join(targetDirectory, entry.name);
        const relativePath = joinPackageRelativePath(relativeDirectory, entry.name);

        if (entry.isSymlink) {
            skippedEntries.push(sourcePath);
            continue;
        }

        if (entry.isDirectory) {
            if (SKIPPED_PACKAGE_DIRECTORIES.has(entry.name)) {
                skippedEntries.push(sourcePath);
                continue;
            }

            await copyPluginPackageDirectory(
                sourcePath,
                targetPath,
                relativePath,
                dependencies,
                copiedFiles,
                integrityFiles,
                skippedEntries,
            );
            continue;
        }

        if (!entry.isFile) {
            skippedEntries.push(sourcePath);
            continue;
        }

        const bytes = await dependencies.readBinaryFile(sourcePath);
        await dependencies.writeBinaryFile(targetPath, bytes);
        copiedFiles.push(targetPath);
        integrityFiles.push(await createEditorPluginPackageIntegrityFile(relativePath, bytes));
    }
}

function joinPackageRelativePath(directory: string, name: string): string {
    return (directory ? `${directory}/${name}` : name).replaceAll('\\', '/').replaceAll(/^\/+/gu, '');
}

function normalizeComparablePath(path: string): string {
    return path.replaceAll('\\', '/').replaceAll(/\/+$/gu, '').toLocaleLowerCase();
}

async function resolveInstallTargetPath(
    record: EditorPluginSourceRecord,
    dependencies: Pick<EditorPluginPackageInstallDependencies, 'join'>,
    installRoot?: string,
): Promise<string> {
    if (record.install.targetPath) return record.install.targetPath;
    if (!installRoot) {
        throw new Error('Plugin source record is missing install.targetPath; choose an install root first.');
    }

    return dependencies.join(installRoot, record.install.directoryName);
}
