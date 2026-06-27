import type { FsFilePickerFilter, FsFilePickerOptions, FsPickedFile } from './fs';

import { AUDIO_EXT, FONT_EXT, getExtension, IMG_EXT, TEXT_EXT } from '../utils/assetTypes';
import { sanitizeFileName } from '../utils/sanitizeFileName';
import {
    fsJoin,
    fsMkdir,
    fsPickBinaryFiles,
    fsReadDirectory,
    fsWriteBinaryFile,
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
    join: (...parts: string[]) => Promise<string>;
    mkdir: (path: string, recursive?: boolean) => Promise<void>;
    pickBinaryFiles: (options?: FsFilePickerOptions) => Promise<FsPickedFile[]>;
    readDirectory: (path: string) => Promise<readonly { name: string }[]>;
    writeBinaryFile: (path: string, content: Uint8Array) => Promise<void>;
};

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
    join: fsJoin,
    mkdir: fsMkdir,
    pickBinaryFiles: fsPickBinaryFiles,
    readDirectory: fsReadDirectory,
    writeBinaryFile: fsWriteBinaryFile,
};

export async function importAssetFiles(
    projectPath: string,
    files: readonly FsPickedFile[],
    options: AssetImportOptions = {},
    dependencies: AssetImportServiceDependencies = defaultAssetImportDependencies,
): Promise<AssetImportResult> {
    if (files.length === 0) {
        return { imported: [] };
    }

    const existingNamesByFolder = await readExistingNamesByTargetFolder(projectPath, files, options, dependencies);
    const plan = planAssetImports(files, existingNamesByFolder, options);
    const imported: AssetImportResultEntry[] = [];

    for (const entry of plan) {
        const targetDirectory = await dependencies.join(projectPath, entry.targetFolder);
        const targetPath = await dependencies.join(targetDirectory, entry.targetName);
        await dependencies.writeBinaryFile(targetPath, files[entry.sourceIndex]?.bytes ?? new Uint8Array());
        imported.push({ ...entry, targetPath });
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
    files: readonly Pick<FsPickedFile, 'name'>[],
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

async function readExistingNamesByTargetFolder(
    projectPath: string,
    files: readonly FsPickedFile[],
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
