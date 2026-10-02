import type { FsFilePickerFilter, FsFilePickerOptions, FsImportFile } from './fs';

import { AUDIO_EXT, FONT_EXT, getExtension, IMG_EXT, TEXT_EXT } from '../utils/assetTypes';
import { sanitizeFileName } from '../utils/sanitizeFileName';
import {
    fsCopyFileExclusive,
    fsJoin,
    fsMkdir,
    fsPickImportFiles,
    fsReadDirectory,
    fsWriteBinaryFileExclusive,
} from './fs';

export type AssetImportKind =
    | 'background'
    | 'bgm'
    | 'data'
    | 'font'
    | 'misc'
    | 'sfx'
    | 'sprite'
    | 'voice';

export type AssetImportOptions = {
    preferredKind?: AssetImportKind;
    signal?: AbortSignal;
};

export type AssetImportPlanEntry = {
    assetUrl: string;
    collisionResolved: boolean;
    kind: AssetImportKind;
    sanitizedName: string;
    sourceIndex: number;
    sourceName: string;
    targetFolder: string;
    targetName: string;
};

export type AssetImportResult = {
    imported: AssetImportResultEntry[];
};

export type AssetImportResultEntry = {
    targetPath: string;
} & AssetImportPlanEntry;

export type AssetImportServiceDependencies = {
    copyFileExclusive?: (sourcePath: string, targetPath: string) => Promise<void>;
    join: (...parts: string[]) => Promise<string>;
    mkdir: (path: string, recursive?: boolean) => Promise<void>;
    pickBinaryFiles: (options?: FsFilePickerOptions) => Promise<FsImportFile[]>;
    readDirectory: (path: string) => Promise<readonly { name: string }[]>;
    writeBinaryFile: (path: string, content: Uint8Array) => Promise<void>;
};

export class AssetImportError extends Error {
    constructor(public readonly imported: AssetImportResultEntry[], public readonly failed: AssetImportPlanEntry | undefined, message: string) {
        super(`${message} ${imported.length} asset(s) imported before stopping.`);
        this.name = 'AssetImportError';
    }
}

export const ASSET_IMPORT_FOLDERS: Record<AssetImportKind, string> = {
    background: 'assets/bg',
    bgm: 'assets/bgm',
    data: 'assets/data',
    font: 'assets/fonts',
    misc: 'assets/misc',
    sfx: 'assets/sfx',
    sprite: 'assets/sprites',
    voice: 'assets/voice',
};

export const ASSET_IMPORT_PICKER_FILTERS: FsFilePickerFilter[] = [
    { extensions: extensionsFromSet(IMG_EXT), name: 'Images' },
    { extensions: extensionsFromSet(AUDIO_EXT), name: 'Audio' },
    { extensions: extensionsFromSet(FONT_EXT), name: 'Fonts' },
    { extensions: ['json', ...extensionsFromSet(TEXT_EXT)], name: 'Data and Text' },
];

const defaultAssetImportDependencies: AssetImportServiceDependencies = {
    copyFileExclusive: fsCopyFileExclusive,
    join: fsJoin,
    mkdir: fsMkdir,
    pickBinaryFiles: fsPickImportFiles,
    readDirectory: fsReadDirectory,
    writeBinaryFile: fsWriteBinaryFileExclusive,
};

export async function importAssetFiles(
    projectPath: string,
    files: readonly FsImportFile[],
    options: AssetImportOptions = {},
    dependencies: AssetImportServiceDependencies = defaultAssetImportDependencies,
): Promise<AssetImportResult> {
    if (files.length === 0) {
        return { imported: [] };
    }

    const existingNamesByFolder = await readExistingNamesByTargetFolder(projectPath, files, options, dependencies);
    const plan = planAssetImports(files, existingNamesByFolder, options);
    const imported: AssetImportResultEntry[] = [];
    const reservedNames = new Map<string, Set<string>>();
    for (const entry of plan) {
        const names = reservedNames.get(entry.targetFolder) ?? new Set<string>();
        names.add(entry.targetName.toLowerCase());
        reservedNames.set(entry.targetFolder, names);
    }

    for (const entry of plan) {
        if (options.signal?.aborted) throw new AssetImportError(imported, entry, 'Import cancelled.');
        const targetDirectory = await dependencies.join(projectPath, entry.targetFolder);
        const file = files[entry.sourceIndex];
        if (!file) throw new AssetImportError(imported, entry, 'The selected asset is unavailable.');
        let candidate = entry;
        for (let attempt = 0; ; attempt += 1) {
            const targetPath = await dependencies.join(targetDirectory, candidate.targetName);
            try {
                if (file.path && dependencies.copyFileExclusive) {
                    await dependencies.copyFileExclusive(file.path, targetPath);
                } else if (file.bytes) {
                    await dependencies.writeBinaryFile(targetPath, file.bytes);
                } else {
                    throw new Error('The selected asset has no readable source.');
                }
                imported.push({ ...candidate, targetPath });
                break;
            } catch (error) {
                if (attempt < 32 && isAlreadyExists(error)) {
                    const used = reservedNames.get(entry.targetFolder) ?? new Set<string>();
                    for (const existing of await dependencies.readDirectory(targetDirectory)) used.add(existing.name.toLowerCase());
                    const targetName = uniqueFileName(entry.sanitizedName, used);
                    candidate = { ...entry, assetUrl: `/${entry.targetFolder}/${targetName}`, collisionResolved: true, targetName };
                    continue;
                }
                throw new AssetImportError(imported, candidate, getImportErrorMessage(error));
            }
        }
    }

    return { imported };
}

export async function importAssetsFromPicker(
    projectPath: string,
    options: AssetImportOptions = {},
    dependencies: AssetImportServiceDependencies = defaultAssetImportDependencies,
): Promise<AssetImportResult> {
    const files = await dependencies.pickBinaryFiles({
        filters: ASSET_IMPORT_PICKER_FILTERS,
        multiple: true,
        title: 'Import assets',
    });

    return importAssetFiles(projectPath, files, options, dependencies);
}

export function inferAssetImportKind(name: string, preferredKind?: AssetImportKind): AssetImportKind {
    if (preferredKind) return preferredKind;

    const extension = getExtension(name);
    const lowerName = basenameFromPath(name).toLowerCase();

    if (IMG_EXT.has(extension)) {
        return /(backdrop|background|\bbg\b|scene|stage)/u.test(lowerName) ? 'background' : 'sprite';
    }

    if (AUDIO_EXT.has(extension)) {
        if (/(bgm|loop|music|song|theme)/u.test(lowerName)) return 'bgm';
        if (/(dialogue|line|voice|\bvo\b)/u.test(lowerName)) return 'voice';
        return 'sfx';
    }

    if (FONT_EXT.has(extension)) return 'font';
    if (extension === '.json' || TEXT_EXT.has(extension)) return 'data';

    return 'misc';
}

export function planAssetImports(
    files: readonly Pick<FsImportFile, 'name'>[],
    existingNamesByFolder: ReadonlyMap<string, Iterable<string>> = new Map(),
    options: AssetImportOptions = {},
): AssetImportPlanEntry[] {
    const usedNamesByFolder = new Map<string, Set<string>>();

    return files.map((file, sourceIndex) => {
        const sourceName = basenameFromPath(file.name);
        const kind = inferAssetImportKind(sourceName, options.preferredKind);
        const targetFolder = ASSET_IMPORT_FOLDERS[kind];
        const sanitizedName = sanitizeImportFileName(sourceName);
        const targetName = uniqueFileName(sanitizedName, usedNameSetForFolder(targetFolder, existingNamesByFolder, usedNamesByFolder));

        return {
            assetUrl: `/${targetFolder}/${targetName}`,
            collisionResolved: targetName !== sanitizedName,
            kind,
            sanitizedName,
            sourceIndex,
            sourceName,
            targetFolder,
            targetName,
        };
    });
}

function basenameFromPath(path: string): string {
    return path.split(/[\\/]/u).findLast(Boolean) ?? path;
}

function extensionsFromSet(extensions: ReadonlySet<string>): string[] {
    return [...extensions].map((extension) => extension.replace(/^\./u, ''));
}

function getImportErrorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    if (typeof error === 'object' && error !== null && 'message' in error) return String(error.message);
    return String(error);
}

function isAlreadyExists(error: unknown): boolean {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === 'alreadyExists';
}

async function readExistingNamesByTargetFolder(
    projectPath: string,
    files: readonly FsImportFile[],
    options: AssetImportOptions,
    dependencies: AssetImportServiceDependencies,
): Promise<Map<string, string[]>> {
    const targetFolders = new Set(files.map((file) => ASSET_IMPORT_FOLDERS[inferAssetImportKind(file.name, options.preferredKind)]));
    const existingNamesByFolder = new Map<string, string[]>();

    for (const targetFolder of targetFolders) {
        const targetDirectory = await dependencies.join(projectPath, targetFolder);
        await dependencies.mkdir(targetDirectory, true);
        const entries = await dependencies.readDirectory(targetDirectory);
        existingNamesByFolder.set(targetFolder, entries.map((entry) => entry.name));
    }

    return existingNamesByFolder;
}

function sanitizeImportFileName(name: string): string {
    return sanitizeFileName(name) || 'asset';
}

function splitFileName(name: string): { extension: string; root: string } {
    const extensionIndex = name.lastIndexOf('.');
    if (extensionIndex <= 0) {
        return { extension: '', root: name || 'asset' };
    }

    return {
        extension: name.slice(extensionIndex),
        root: name.slice(0, extensionIndex) || 'asset',
    };
}

function uniqueFileName(name: string, usedNames: Set<string>): string {
    const lowerName = name.toLowerCase();
    if (!usedNames.has(lowerName)) {
        usedNames.add(lowerName);
        return name;
    }

    const { extension, root } = splitFileName(name);
    let index = 2;
    let candidate = `${root}_${index}${extension}`;

    while (usedNames.has(candidate.toLowerCase())) {
        index += 1;
        candidate = `${root}_${index}${extension}`;
    }

    usedNames.add(candidate.toLowerCase());
    return candidate;
}

function usedNameSetForFolder(
    folder: string,
    existingNamesByFolder: ReadonlyMap<string, Iterable<string>>,
    usedNamesByFolder: Map<string, Set<string>>,
): Set<string> {
    const current = usedNamesByFolder.get(folder);
    if (current) return current;

    const existingNames = new Set(
        [...(existingNamesByFolder.get(folder) ?? [])].map((name) => name.toLowerCase()),
    );
    usedNamesByFolder.set(folder, existingNames);
    return existingNames;
}
