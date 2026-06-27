import type {
    CharacterDefinition,
    CompiledAssetDependencies,
    CompiledContentCacheEntry,
    CompiledContentManifest,
    GameManifest,
    ItemManifestEntry,
    LocaleBundle,
    SceneFile,
    Script,
} from 'core';
import type { Zippable } from 'fflate';

import { collectCompiledContentCacheSources, compileContentManifest, mergeAssetDependencies } from 'core';
import { strToU8, zipSync } from 'fflate';

import type { BrowserDesktopExportArtifactManifest } from './browserParityReport';
import type { ExportCachePolicy, ExportGameOptions, ExportGameResult } from './exportGame';

import { createBrowserDesktopExportArtifactManifest } from './browserParityReport';
import { fsReadBinaryFile, fsReadDirectory, fsReadTextFile } from './fs';

const PLAYER_TEMPLATE_FILES = import.meta.glob<string>(
    '../../../player/dist/{index.html,assets/*.js}',
    {
        eager: true,
    import: 'default',
    query: '?raw',
    },
);

export async function exportGameForBrowser(
    gamePath: string,
    options: ExportGameOptions = {},
): Promise<ExportGameResult> {
    const zipEntries: Zippable = {};
    const playerFileCount = addPlayerTemplateFiles(zipEntries);
    const projectFiles = await addProjectFiles(zipEntries, gamePath);
    await addCompiledContentManifest(zipEntries, gamePath, options.cachePolicy ?? 'hashed');
    const artifactManifest = await createBrowserExportArtifactManifest(zipEntries, projectFiles);
    const zipBytes = zipSync(zipEntries, { level: 9 });
    const zipBuffer = zipBytes.buffer.slice(zipBytes.byteOffset, zipBytes.byteOffset + zipBytes.byteLength);
    const downloadName = toDownloadFileName(options.zipFile, gamePath);

    if (options.download !== false) {
        downloadBlob(new Blob([zipBuffer], { type: 'application/zip' }), downloadName);
    }

    return {
        artifactManifest,
        stderr: options.zip === false
            ? 'Browser exports are downloaded as zip archives even when zip is disabled.\n'
            : '',
        stdout: [
            options.download === false
                ? `Prepared browser export artifact: ${downloadName}`
                : `Created browser export download: ${downloadName}`,
            `Included ${projectFiles.length} project files and ${playerFileCount} player runtime files.`,
            'Included compiled content manifest: zerith.content.json',
            `Compiled content cache: ${formatCachePolicy(options.cachePolicy ?? 'hashed')}`,
            `Base URL: ${options.base ?? './'}`,
        ].join('\n'),
    };
}

async function addCompiledContentManifest(
    zipEntries: Zippable,
    gamePath: string,
    cachePolicy: ExportCachePolicy,
): Promise<void> {
    const manifest = await readJson<GameManifest>(joinVirtualPath(gamePath, 'game.json'));
    const characters = await readManifestValue<Record<string, CharacterDefinition>>(gamePath, manifest.characters, {});
    const items = await readManifestValue<Record<string, ItemManifestEntry>>(gamePath, manifest.items, {});
    const macros = await readManifestValue<Record<string, Script>>(gamePath, manifest.macros, {});
    const scenes = await readScenes(gamePath, manifest.scenes ?? {});
    const locales = await readLocales(gamePath, manifest.localization?.locales ?? {});
    const compiled = compileContentManifest({
        characters,
        items,
        locales,
        macros,
        manifest,
        scenes,
    });
    const hydrated = await hydrateCompiledDescriptorSources(gamePath, compiled);
    const exported = cachePolicy === 'none'
        ? hydrated
        : await attachCacheManifest(gamePath, manifest, hydrated);
    zipEntries['zerith.content.json'] = strToU8(`${JSON.stringify(exported, undefined, 2)}\n`);
}

function addPlayerTemplateFiles(zipEntries: Zippable): number {
    const templateEntries = Object.entries(PLAYER_TEMPLATE_FILES);
    if (templateEntries.length === 0) {
        throw new Error('Browser player template is missing. Run the player build before building the editor.');
    }

    let fileCount = 0;
    for (const [sourcePath, contents] of templateEntries) {
        const zipPath = toPlayerTemplateZipPath(sourcePath);
        zipEntries[zipPath] = strToU8(zipPath === 'index.html' ? rewritePlayerIndex(contents) : contents);
        fileCount += 1;
    }

    return fileCount;
}

async function addProjectFiles(zipEntries: Zippable, gamePath: string): Promise<string[]> {
    const projectFiles: string[] = [];

    const walk = async (directoryPath: string) => {
        const entries = await fsReadDirectory(directoryPath);

        for (const entry of entries) {
            const path = joinVirtualPath(directoryPath, entry.name);
            if (entry.isDirectory) {
                await walk(path);
                continue;
            }

            if (!entry.isFile) continue;

            const zipPath = toProjectZipPath(gamePath, path);
            if (zipEntries[zipPath]) continue;

            zipEntries[zipPath] = await fsReadBinaryFile(path);
            projectFiles.push(zipPath);
        }
    };

    await walk(gamePath);
    return projectFiles;
}

async function attachCacheManifest(
    gamePath: string,
    manifest: GameManifest,
    compiled: CompiledContentManifest,
): Promise<CompiledContentManifest> {
    const entries: Record<string, CompiledContentCacheEntry> = {};
    const sources = [
        ...collectCompiledContentCacheSources(manifest, compiled),
        { kind: 'content' as const, path: 'engine.config.json' },
    ];

    await Promise.all(sources.map(async (source) => {
        if (entries[source.path]) {
            return;
        }

        const bytes = await readCacheSourceBytes(gamePath, source.path);
        if (!bytes) {
            return;
        }

        entries[source.path] = {
            hash: await sha256Hex(bytes),
            kind: source.kind,
            size: bytes.byteLength,
        };
    }));

    return {
        ...compiled,
        cache: {
            algorithm: 'sha256',
            entries: sortCacheEntries(entries),
        },
    };
}

function basename(path: string): string {
    return path.split(/[\\/]/).findLast((segment) => segment.length > 0) ?? 'game';
}

function cloneDependencies(dependencies: CompiledAssetDependencies): CompiledAssetDependencies {
    return {
        audio: [...dependencies.audio],
        audiosheets: [...dependencies.audiosheets],
        spritesheets: [...dependencies.spritesheets],
        textures: [...dependencies.textures],
    };
}

async function createBrowserExportArtifactManifest(
    zipEntries: Zippable,
    projectFiles: readonly string[],
): Promise<BrowserDesktopExportArtifactManifest> {
    const compiledContentBytes = toHashableBytes(zipEntries['zerith.content.json']);
    const fileHashes = compiledContentBytes === undefined
        ? undefined
        : { 'zerith.content.json': await sha256Hex(compiledContentBytes) };

    return createBrowserDesktopExportArtifactManifest(Object.keys(zipEntries), {
        ...(fileHashes === undefined ? {} : { fileHashes }),
        projectFiles,
    });
}

function downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = filename;
    link.href = url;
    link.style.display = 'none';
    document.body.append(link);
    link.click();
    link.remove();
    globalThis.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function formatCachePolicy(cachePolicy: ExportCachePolicy): string {
    return cachePolicy === 'none' ? 'disabled' : 'hashed local files';
}

async function hydrateCompiledDescriptorSources(
    gamePath: string,
    compiled: CompiledContentManifest,
): Promise<CompiledContentManifest> {
    const [audiosheetSources, spritesheetSources] = await Promise.all([
        readSheetSources(gamePath, compiled.assets.all.audiosheets, 'audio'),
        readSheetSources(gamePath, compiled.assets.all.spritesheets, 'texture'),
    ]);
    const byScene = Object.fromEntries(
        Object.entries(compiled.assets.byScene).map(([sceneName, dependencies]) => [
            sceneName,
            hydrateDependencies(dependencies, audiosheetSources, spritesheetSources),
        ]),
    );
    const global = hydrateDependencies(compiled.assets.global, audiosheetSources, spritesheetSources);

    return {
        ...compiled,
        assets: {
            all: mergeAssetDependencies(global, ...Object.values(byScene)),
            byScene,
            global,
        },
        scenes: Object.fromEntries(Object.entries(compiled.scenes).map(([sceneName, scene]) => {
            const dependencies = byScene[sceneName] ?? scene.dependencies;
            return [
                sceneName,
                {
                    ...scene,
                    dependencies,
                },
            ];
        })),
    };
}

function hydrateDependencies(
    dependencies: CompiledAssetDependencies,
    audiosheetSources: Record<string, string>,
    spritesheetSources: Record<string, string>,
): CompiledAssetDependencies {
    const next = cloneDependencies(dependencies);

    for (const sheetUrl of dependencies.audiosheets) {
        const source = audiosheetSources[sheetUrl];
        if (source) next.audio.push(source);
    }

    for (const sheetUrl of dependencies.spritesheets) {
        const source = spritesheetSources[sheetUrl];
        if (source) next.textures.push(source);
    }

    return {
        audio: uniqueSorted(next.audio),
        audiosheets: uniqueSorted(next.audiosheets),
        spritesheets: uniqueSorted(next.spritesheets),
        textures: uniqueSorted(next.textures),
    };
}

function isExternalAssetPath(assetPath: string): boolean {
    return /^(?:[a-z]+:)?\/\//iu.test(assetPath) || assetPath.startsWith('data:');
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function joinVirtualPath(directoryPath: string, name: string): string {
    return `${directoryPath.replaceAll(/\/+$/gu, '')}/${name}`;
}

async function readCacheSourceBytes(gamePath: string, assetPath: string): Promise<Uint8Array | undefined> {
    if (isExternalAssetPath(assetPath)) {
        return;
    }

    try {
        return await fsReadBinaryFile(resolveProjectFilePath(gamePath, assetPath));
    } catch {
        return;
    }
}

async function readJson<T>(path: string): Promise<T> {
    return JSON.parse(await fsReadTextFile(path)) as T;
}

async function readLocales(
    gamePath: string,
    locales: Record<string, LocaleBundle | string>,
): Promise<Record<string, LocaleBundle>> {
    const entries = await Promise.all(Object.entries(locales).map(async ([locale, value]) => [
        locale,
        typeof value === 'string'
            ? await readJson<LocaleBundle>(resolveProjectFilePath(gamePath, value))
            : value,
    ] as const));

    return Object.fromEntries(entries);
}

async function readManifestValue<T>(gamePath: string, value: string | T | undefined, fallback: T): Promise<T> {
    if (typeof value === 'string') {
        return readJson<T>(resolveProjectFilePath(gamePath, value));
    }

    return value ?? fallback;
}

async function readScenes(
    gamePath: string,
    scenes: Record<string, SceneFile | Script | string>,
): Promise<Record<string, SceneFile | Script>> {
    const entries = await Promise.all(Object.entries(scenes).map(async ([sceneName, scene]) => [
        sceneName,
        typeof scene === 'string'
            ? await readJson<SceneFile | Script>(resolveProjectFilePath(gamePath, scene))
            : scene,
    ] as const));

    return Object.fromEntries(entries);
}

async function readSheetSources(
    gamePath: string,
    sheetUrls: string[],
    sourceKind: 'audio' | 'texture',
): Promise<Record<string, string>> {
    const sources: Record<string, string> = {};

    await Promise.all(sheetUrls.map(async (sheetUrl) => {
        if (isExternalAssetPath(sheetUrl)) return;

        const descriptorPath = resolveProjectFilePath(gamePath, sheetUrl);

        try {
            const descriptor = await readJson<unknown>(descriptorPath);
            let source = isRecord(descriptor) && typeof descriptor.source === 'string'
                ? descriptor.source
                : undefined;
            if (
                !source
                && sourceKind === 'texture'
                && isRecord(descriptor)
                && isRecord(descriptor.meta)
                && typeof descriptor.meta.image === 'string'
            ) {
                source = descriptor.meta.image;
            }
            if (source) {
                sources[sheetUrl] = resolveSheetSource(sheetUrl, source);
            }
        } catch {
            // External or missing descriptors are still listed as descriptor dependencies.
        }
    }));

    return sources;
}

function resolveProjectFilePath(gamePath: string, assetPath: string): string {
    if (isExternalAssetPath(assetPath)) return assetPath;
    return assetPath.startsWith('/')
        ? joinVirtualPath(gamePath, assetPath.slice(1))
        : joinVirtualPath(gamePath, assetPath);
}

function resolveSheetSource(sheetUrl: string, source: string): string {
    if (source.startsWith('/') || isExternalAssetPath(source)) {
        return source;
    }

    const directory = sheetUrl.slice(0, Math.max(0, sheetUrl.lastIndexOf('/') + 1));
    return `${directory}${source}`;
}

function rewritePlayerIndex(contents: string): string {
    return contents.replaceAll('./assets/', './zerith-player/');
}

function sanitizeFileName(value: string): string {
    const withoutControlCharacters = [...value]
        .filter((character) => (character.codePointAt(0) ?? 0) >= 32)
        .join('');
    return withoutControlCharacters.replaceAll(/[<>:"/\\|?*]+/gu, '-').replaceAll(/^-|-$/gu, '') || 'game';
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
    if (!globalThis.crypto?.subtle) {
        throw new Error('Browser export requires Web Crypto support to hash compiled content.');
    }

    const buffer = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(buffer).set(bytes);
    const digest = await globalThis.crypto.subtle.digest('SHA-256', buffer);
    return [...new Uint8Array(digest)]
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('');
}

function sortCacheEntries(
    entries: Record<string, CompiledContentCacheEntry>,
): Record<string, CompiledContentCacheEntry> {
    return Object.fromEntries(
        Object.entries(entries)
            .toSorted(([left], [right]) => left.localeCompare(right)),
    );
}

function toDownloadFileName(zipFile: string | undefined, gamePath: string): string {
    const fileName = basename(zipFile?.trim() || `${basename(gamePath)}.zip`);
    return sanitizeFileName(fileName.endsWith('.zip') ? fileName : `${fileName}.zip`);
}

function toHashableBytes(value: unknown): Uint8Array | undefined {
    if (value instanceof Uint8Array) return value;
    if (typeof value === 'string') return strToU8(value);

    return undefined;
}

function toPlayerTemplateZipPath(sourcePath: string): string {
    const normalizedPath = sourcePath.replaceAll('\\', '/');
    const relativePath = normalizedPath.slice(normalizedPath.lastIndexOf('/dist/') + '/dist/'.length);
    if (relativePath === 'index.html') return 'index.html';
    return relativePath.replace(/^assets\//u, 'zerith-player/');
}

function toProjectZipPath(rootPath: string, filePath: string): string {
    const normalizedRoot = rootPath.replaceAll('\\', '/').replaceAll(/\/+$/gu, '');
    const normalizedFile = filePath.replaceAll('\\', '/');
    const relativePath = normalizedFile.startsWith(`${normalizedRoot}/`)
        ? normalizedFile.slice(normalizedRoot.length + 1)
        : normalizedFile;
    return relativePath.replaceAll(/^\/+/gu, '');
}

function uniqueSorted(values: string[]): string[] {
    return [...new Set(values)].toSorted((left, right) => left.localeCompare(right));
}
