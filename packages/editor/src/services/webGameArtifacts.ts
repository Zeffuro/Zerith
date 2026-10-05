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
} from '@zeffuro/zerith-core';
import type { Zippable } from 'fflate';

import { collectCompiledContentCacheSources, compileContentManifest, mergeAssetDependencies } from '@zeffuro/zerith-core';
import { strToU8 } from 'fflate';

import type { BrowserDesktopExportArtifactManifest } from './browserParityReport';
import type { ExportCachePolicy, ExportGameOptions } from './exportGame';

import { createBrowserDesktopExportArtifactManifest } from './browserParityReport';
import { fsReadBinaryFile, fsReadDirectory, fsReadTextFile } from './fs';

const PLAYER_TEMPLATE_FILES = import.meta.glob<string>(
    '../../../player/dist/{index.html,assets/*.js,assets/*.css}',
    {
        eager: true,
        import: 'default',
        query: '?raw',
    },
);

export type NativeProjectFile = { path: string; sourcePath: string };

export type WebGameArtifacts = {
    artifactManifest: BrowserDesktopExportArtifactManifest;
    files: Record<string, Uint8Array>;
    nativeFiles: NativeProjectFile[];
    playerFileCount: number;
    projectFiles: string[];
};

type PrepareWebGameDependencies = {
    nativeProjectFiles?: boolean;
};

export async function prepareWebGameArtifacts(
    gamePath: string,
    options: ExportGameOptions = {},
    dependencies: PrepareWebGameDependencies = {},
): Promise<WebGameArtifacts> {
    const files: Record<string, Uint8Array> = Object.create(null) as Record<string, Uint8Array>;
    const playerFileCount = addPlayerTemplateFiles(files, options.base ?? './');
    const nativeFiles: NativeProjectFile[] = [];
    const projectFiles = await addProjectFiles(files, gamePath, dependencies.nativeProjectFiles ? nativeFiles : undefined);
    await addCompiledContentManifest(files, gamePath, options.cachePolicy ?? 'hashed', dependencies.nativeProjectFiles ?? false);
    const artifactManifest = await createBrowserExportArtifactManifest(files, projectFiles, nativeFiles);
    return { artifactManifest, files, nativeFiles, playerFileCount, projectFiles };
}

async function addCompiledContentManifest(
    zipEntries: Zippable,
    gamePath: string,
    cachePolicy: ExportCachePolicy,
    nativeProjectFiles: boolean,
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
        : await attachCacheManifest(gamePath, manifest, hydrated, nativeProjectFiles);
    zipEntries['zerith.content.json'] = strToU8(`${JSON.stringify(exported, undefined, 2)}\n`);
}

function addPlayerTemplateFiles(zipEntries: Zippable, base: string): number {
    const templateEntries = Object.entries(PLAYER_TEMPLATE_FILES);
    if (templateEntries.length === 0) {
        throw new Error('Player template is missing. Rebuild the editor with its player template.');
    }

    let fileCount = 0;
    for (const [sourcePath, contents] of templateEntries) {
        const zipPath = toPlayerTemplateZipPath(sourcePath);
        zipEntries[zipPath] = strToU8(zipPath === 'index.html' ? rewritePlayerIndex(contents, base) : contents);
        fileCount += 1;
    }

    return fileCount;
}

async function addProjectFiles(zipEntries: Zippable, gamePath: string, nativeFiles?: NativeProjectFile[]): Promise<string[]> {
    const projectFiles: string[] = [];

    const walk = async (directoryPath: string) => {
        const entries = await fsReadDirectory(directoryPath);

        for (const entry of entries) {
            if (['.dev_docs', '.git', 'node_modules'].includes(entry.name.toLowerCase())) continue;
            const path = joinVirtualPath(directoryPath, entry.name);
            if (entry.isSymlink) {
                throw new Error(`Cannot export symbolic link: ${path}`);
            }
            if (entry.isDirectory) {
                await walk(path);
                continue;
            }

            if (!entry.isFile) continue;

            const zipPath = toProjectZipPath(gamePath, path);
            if (zipPath === 'index.html' || zipPath === 'zerith.content.json' || zipPath.startsWith('zerith-player/')) {
                throw new Error(`Project file conflicts with player output: ${zipPath}`);
            }

            if (nativeFiles) {
                nativeFiles.push({ path: zipPath, sourcePath: path });
            } else {
                zipEntries[zipPath] = await fsReadBinaryFile(path);
            }
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
    nativeProjectFiles: boolean,
): Promise<CompiledContentManifest> {
    const entries: Record<string, CompiledContentCacheEntry> = {};
    const sources = [
        ...collectCompiledContentCacheSources(manifest, compiled),
        { kind: 'content' as const, path: 'engine.config.json' },
    ];

    if (nativeProjectFiles) {
        const { invoke } = await import('@tauri-apps/api/core');
        const localSources = sources.filter((source) => !isExternalAssetPath(source.path));
        const sourcePaths = localSources.map((source) => toProjectZipPath(gamePath, resolveProjectFilePath(gamePath, source.path)));
        const hashes = await invoke<Record<string, { hash: string; size: number }>>('hash_export_sources', {
            gamePath,
            paths: [...new Set(sourcePaths)],
        });
        for (const [index, source] of localSources.entries()) {
            const hash = hashes[sourcePaths[index]];
            if (hash) entries[source.path] = { hash: hash.hash, kind: source.kind, size: hash.size };
        }
    } else {
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
    }

    return {
        ...compiled,
        cache: {
            algorithm: 'sha256',
            entries: sortCacheEntries(entries),
        },
    };
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
    nativeFiles: readonly NativeProjectFile[],
): Promise<BrowserDesktopExportArtifactManifest> {
    const compiledContentBytes = toHashableBytes(zipEntries['zerith.content.json']);
    const fileHashes = compiledContentBytes === undefined
        ? undefined
        : { 'zerith.content.json': await sha256Hex(compiledContentBytes) };

    return createBrowserDesktopExportArtifactManifest([...Object.keys(zipEntries), ...nativeFiles.map((file) => file.path)], {
        ...(fileHashes === undefined ? {} : { fileHashes }),
        projectFiles,
    });
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
    const segments: string[] = [];
    for (const segment of assetPath.replaceAll('\\', '/').split('/')) {
        if (!segment || segment === '.') continue;
        if (segment.toLowerCase() === '.dev_docs') throw new Error('Private project files cannot be exported.');
        if (segment === '..') {
            if (segments.length === 0) throw new Error(`Project reference escapes its directory: ${assetPath}`);
            segments.pop();
        } else {
            if (segment.includes(':')) throw new Error(`Invalid project reference: ${assetPath}`);
            segments.push(segment);
        }
    }
    return joinVirtualPath(gamePath, segments.join('/'));
}

function resolveSheetSource(sheetUrl: string, source: string): string {
    if (source.startsWith('/') || isExternalAssetPath(source)) {
        return source;
    }

    const directory = sheetUrl.slice(0, Math.max(0, sheetUrl.lastIndexOf('/') + 1));
    return `${directory}${source}`;
}

function rewritePlayerIndex(contents: string, base: string): string {
    if (!/^(?:\.\/|\/(?!\/)|https?:\/\/)/iu.test(base) || /[\s<>"'`\\?#]/u.test(base)
        || [...base].some(character => character.codePointAt(0)! < 32)) {
        throw new Error('Export base must be ./, a host path, or an http(s) directory URL without whitespace, query, or fragment.');
    }
    try { new URL(base, 'https://export.invalid/'); } catch {
        throw new Error('Export base must be a valid path or http(s) URL.');
    }
    const prefix = base.endsWith('/') ? base : `${base}/`;
    const htmlPrefix = prefix.replaceAll('&', '&amp;');
    return contents.replace('<head>', `<head>\n  <meta name="zerith-base-url" content="${htmlPrefix}" />`)
        .replaceAll('./assets/', `${htmlPrefix}zerith-player/`);
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
