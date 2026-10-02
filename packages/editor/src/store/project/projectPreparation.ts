import type {
    CharacterDefinition,
    Command,
    GameManifest,
    ItemManifestEntry,
    LocaleBundle,
} from '@zeffuro/zerith-core';

import { parseLocaleBundle, parseSceneFile, validateScript } from '@zeffuro/zerith-core/schemas';

import type { ProjectManifestData } from './types';

import { type FsDirectoryEntry, fsReadDirectory, fsReadTextFile } from '../../services/fs';
import { isRecord } from '../../utils/typeGuards';

export type PreparedProject = {
    files: FsDirectoryEntry[];
    manifestData: ProjectManifestData;
    manifestPath: string;
    projectRoot: string;
};

type LocaleResolution = {
    localePaths: Record<string, string | undefined>;
    locales: Record<string, LocaleBundle>;
};

type SceneResolution = {
    sceneNamespaces: Record<string, string | undefined>;
    scenePaths: Record<string, string | undefined>;
    scenes: Record<string, Command[]>;
};

export async function loadProjectManifest(projectPath: string): Promise<ProjectManifestData> {
    const manifestText = await fsReadTextFile(joinVirtualPath(projectPath, 'game.json'));
    const parsedManifest: unknown = JSON.parse(manifestText);
    if (!isRecord(parsedManifest)) {
        throw new TypeError('Manifest root must be an object');
    }

    const manifest = parsedManifest as GameManifest;

    const [characters, items, macros, sceneResolution, localeResolution] = await Promise.all([
        manifest.characters
            ? resolveManifestRecordFromDisk<CharacterDefinition>(manifest.characters, projectPath, 'Characters')
            : Promise.resolve<Record<string, CharacterDefinition>>({}),
        manifest.items
            ? resolveManifestRecordFromDisk<ItemManifestEntry>(manifest.items, projectPath, 'Items')
            : Promise.resolve<Record<string, ItemManifestEntry>>({}),
        manifest.macros
            ? resolveMacrosDisk(manifest.macros, projectPath)
            : Promise.resolve<Record<string, Command[]>>({}),
        manifest.scenes && isRecord(manifest.scenes)
            ? resolveScenesDisk(manifest.scenes, projectPath)
            : Promise.resolve<SceneResolution>({ sceneNamespaces: {}, scenePaths: {}, scenes: {} }),
        resolveLocalesDisk(manifest.localization?.locales ?? {}, projectPath),
    ]);

    return { characters, items, localePaths: localeResolution.localePaths, locales: localeResolution.locales, macros, manifest, ...sceneResolution };
}

export async function prepareProjectOpen(manifestPath: string): Promise<PreparedProject> {
    const projectRoot = projectRootFromManifestPath(manifestPath);
    if (!projectRoot) throw new Error('Choose a project manifest inside a directory.');
    const [entries, manifestData] = await Promise.all([fsReadDirectory(projectRoot), loadProjectManifest(projectRoot)]);
    const files = entries.toSorted((a, b) => {
        if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
        return a.name.localeCompare(b.name);
    });
    return { files, manifestData, manifestPath, projectRoot };
}

export function projectRootFromManifestPath(manifestPath: string): string {
    const normalized = manifestPath.replaceAll('\\', '/');
    const lastSlash = normalized.lastIndexOf('/');
    if (lastSlash === -1) return '';
    if (lastSlash === 0 || /^[a-z]:$/iu.test(normalized.slice(0, lastSlash))) return normalized.slice(0, lastSlash + 1);
    return normalized.slice(0, lastSlash);
}

export function resolveProjectFilePath(projectPath: string, assetPath: string): string {
    if (isExternalPath(assetPath)) return assetPath;
    return assetPath.startsWith('/')
        ? joinVirtualPath(projectPath, assetPath.slice(1))
        : joinVirtualPath(projectPath, assetPath);
}

function isExternalPath(path: string): boolean {
    return /^(?:[a-z]+:)?\/\//iu.test(path) || path.startsWith('data:');
}

function joinVirtualPath(directoryPath: string, name: string): string {
    return `${directoryPath.replaceAll(/\/+$/gu, '')}/${name}`;
}

async function resolveLocalesDisk(
    localesConfig: Record<string, LocaleBundle | string>,
    projectPath: string,
): Promise<LocaleResolution> {
    const locales: Record<string, LocaleBundle> = {};
    const localePaths: Record<string, string | undefined> = {};

    await Promise.all(Object.entries(localesConfig).map(async ([locale, value]) => {
        const localePath = typeof value === 'string'
            ? resolveProjectFilePath(projectPath, value)
            : undefined;
        localePaths[locale] = localePath;

        try {
            const candidate = typeof value === 'string'
                ? JSON.parse(await fsReadTextFile(localePath!)) as unknown
                : value;
            const parsed = parseLocaleBundle(candidate);
            if (parsed.success) {
                locales[locale] = parsed.data;
                return;
            }
            console.warn(`Ignoring invalid locale bundle '${locale}': ${parsed.error}`);
        } catch (error) {
            console.warn(`Failed to load locale bundle '${locale}':`, error);
        }
    }));

    return { localePaths, locales };
}

async function resolveMacrosDisk(value: unknown, projectPath: string): Promise<Record<string, Command[]>> {
    const candidate = await resolveManifestValueFromDisk<unknown>(value, projectPath);
    if (!isRecord(candidate)) throw new TypeError('Macros must be an object of command arrays.');
    return Object.fromEntries(Object.entries(candidate)
        .filter(([name]) => !name.startsWith('$'))
        .map(([name, commands]) => {
            if (!Array.isArray(commands)) throw new TypeError(`Macro '${name}' must be a command array.`);
            return [name, validateScript(commands)];
        }));
}

async function resolveManifestRecordFromDisk<T>(value: unknown, projectPath: string, label: string): Promise<Record<string, T>> {
    const candidate = await resolveManifestValueFromDisk<unknown>(value, projectPath);
    if (!isRecord(candidate)) throw new TypeError(`${label} must contain a JSON object.`);
    return candidate as Record<string, T>;
}

async function resolveManifestValueFromDisk<T>(value: string | T, projectPath: string): Promise<T> {
    if (typeof value === 'string') {
        const filePath = resolveProjectFilePath(projectPath, value);
        const text = await fsReadTextFile(filePath);
        const parsed: unknown = JSON.parse(text);
        return parsed as T;
    }
    return value;
}

async function resolveScenesDisk(
    scenes: Record<string, unknown>,
    projectPath: string
): Promise<SceneResolution> {
    const resolvedScenes: Record<string, Command[]> = {};
    const sceneNamespaces: Record<string, string | undefined> = {};
    const scenePaths: Record<string, string | undefined> = {};

    await Promise.all(
        Object.entries(scenes).map(async ([name, value]) => {
            if (typeof value !== 'string' && !Array.isArray(value)) {
                const parsed = parseSceneFile(value, { sceneName: name });
                resolvedScenes[name] = parsed.commands;
                sceneNamespaces[name] = typeof parsed.metadata.localeNamespace === 'string'
                    ? parsed.metadata.localeNamespace
                    : undefined;
                scenePaths[name] = undefined;
                return;
            }
            const scenePath = typeof value === 'string'
                ? resolveProjectFilePath(projectPath, value)
                : undefined;
            const sceneFile = typeof value === 'string'
                ? await resolveManifestValueFromDisk<unknown>(value, projectPath)
                : value;
            const parsed = parseSceneFile(sceneFile, { sceneName: name });
            resolvedScenes[name] = parsed.commands;
            sceneNamespaces[name] = typeof parsed.metadata.localeNamespace === 'string'
                ? parsed.metadata.localeNamespace
                : undefined;
            scenePaths[name] = scenePath;
        })
    );

    return { sceneNamespaces, scenePaths, scenes: resolvedScenes };
}
