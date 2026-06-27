import {
    type CharacterDefinition,
    type Command,
    type GameManifest,
    type ItemManifestEntry,
    type LocaleBundle,
    parseLocaleBundle,
    parseSceneFile,
} from 'core';

import type { ProjectGet, ProjectManifestSlice, ProjectSet } from '../types';

import { fsReadTextFile } from '../../../services/fs';
import { isRecord } from '../../../utils/typeGuards';

type LocaleResolution = {
    localePaths: Record<string, string | undefined>;
    locales: Record<string, LocaleBundle>;
};

type SceneResolution = {
    sceneNamespaces: Record<string, string | undefined>;
    scenePaths: Record<string, string | undefined>;
    scenes: Record<string, Command[]>;
};

export function createProjectManifestSlice(set: ProjectSet, get: ProjectGet): ProjectManifestSlice {
    return {
        characters: {},
        items: {},
        loadManifest: async () => {
            const { projectPath } = get();
            if (!projectPath) return;

            try {
                const manifestText = await fsReadTextFile(`${projectPath}/game.json`);
                const parsedManifest: unknown = JSON.parse(manifestText);
                if (!isRecord(parsedManifest)) {
                    throw new TypeError('Manifest root must be an object');
                }

                const manifest = parsedManifest as GameManifest;

                const [characters, items, macros, sceneResolution, localeResolution] = await Promise.all([
                    manifest.characters
                        ? resolveManifestValueFromDisk<Record<string, CharacterDefinition>>(manifest.characters, projectPath)
                        : Promise.resolve<Record<string, CharacterDefinition>>({}),
                    manifest.items
                        ? resolveManifestValueFromDisk<Record<string, ItemManifestEntry>>(manifest.items, projectPath)
                        : Promise.resolve<Record<string, ItemManifestEntry>>({}),
                    manifest.macros
                        ? resolveManifestValueFromDisk<Record<string, Command[]>>(manifest.macros, projectPath)
                        : Promise.resolve<Record<string, Command[]>>({}),
                    manifest.scenes && isRecord(manifest.scenes)
                        ? resolveScenesDisk(manifest.scenes, projectPath)
                        : Promise.resolve<SceneResolution>({ sceneNamespaces: {}, scenePaths: {}, scenes: {} }),
                    resolveLocalesDisk(manifest.localization?.locales ?? {}, projectPath),
                ]);

                set({
                    characters,
                    items,
                    localePaths: localeResolution.localePaths,
                    locales: localeResolution.locales,
                    macros,
                    manifest,
                    sceneNamespaces: sceneResolution.sceneNamespaces,
                    scenePaths: sceneResolution.scenePaths,
                    scenes: sceneResolution.scenes,
                });
            } catch (error) {
                console.error('Failed to load manifest:', error);
            }
        },
        localePaths: {},
        locales: {},
        macros: {},
        manifest: undefined,
        sceneNamespaces: {},
        scenePaths: {},
        scenes: {},
    };
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

async function resolveManifestValueFromDisk<T>(value: string | T, projectPath: string): Promise<T> {
    if (typeof value === 'string') {
        const filePath = resolveProjectFilePath(projectPath, value);
        const text = await fsReadTextFile(filePath);
        const parsed: unknown = JSON.parse(text);
        return parsed as T;
    }
    return value;
}

function resolveProjectFilePath(projectPath: string, assetPath: string): string {
    if (isExternalPath(assetPath)) return assetPath;
    return assetPath.startsWith('/')
        ? joinVirtualPath(projectPath, assetPath.slice(1))
        : joinVirtualPath(projectPath, assetPath);
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


