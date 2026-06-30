import type { BaseCommand, CharacterDefinition, GameManifest, ItemManifestEntry, LocaleBundle, SceneFile, Script } from '../types';
import type {
    CompiledAssetDependencies,
    CompiledContentCacheEntryKind,
    CompiledContentCacheSource,
    CompiledContentManifest,
} from '../types/CompiledContent';

import { toDialogueVoiceAssetReference } from './DialogueVoice';
import { analyzeStoryGraph } from './StoryGraph';

interface CompileContentManifestInput {
    characters?: Record<string, CharacterDefinition>;
    items?: Record<string, ItemManifestEntry>;
    locales?: Record<string, LocaleBundle>;
    macros?: Record<string, Script>;
    manifest: GameManifest;
    scenes: Record<string, SceneFile | Script>;
}

interface ExtractScriptAssetDependenciesOptions {
    macros?: Record<string, Script>;
}

interface MutableAssetDependencies {
    audio: Set<string>;
    audiosheets: Set<string>;
    spritesheets: Set<string>;
    textures: Set<string>;
}

const COMMAND_COLLECTION_KEYS = ['body', 'commands', 'onFalse', 'onTrue'] as const;

export function collectCharacterAssetDependencies(
    characters: Record<string, CharacterDefinition> | undefined,
): CompiledAssetDependencies {
    const assets = createMutableAssetDependencies();

    for (const character of Object.values(characters ?? {})) {
        addAsset(assets.textures, character.portraitUrl);
        addAsset(assets.audio, character.blipUrl);
        addAsset(assets.spritesheets, character.spritesheet?.atlasUrl);
    }

    return freezeAssetDependencies(assets);
}

export function collectCompiledContentCacheSources(
    manifest: GameManifest,
    compiledContent: CompiledContentManifest,
): CompiledContentCacheSource[] {
    const sources = new Map<string, CompiledContentCacheEntryKind>();
    const addSource = (path: string | undefined, kind: CompiledContentCacheEntryKind) => {
        const normalizedPath = normalizeProjectCachePath(path);
        if (!normalizedPath) {
            return;
        }

        sources.set(normalizedPath, kind);
    };

    addSource('game.json', 'content');
    if (typeof manifest.characters === 'string') addSource(manifest.characters, 'content');
    if (typeof manifest.items === 'string') addSource(manifest.items, 'content');
    if (typeof manifest.macros === 'string') addSource(manifest.macros, 'content');

    for (const scene of Object.values(manifest.scenes ?? {})) {
        if (typeof scene === 'string') {
            addSource(scene, 'content');
        }
    }

    for (const locale of Object.values(manifest.localization?.locales ?? {})) {
        if (typeof locale === 'string') {
            addSource(locale, 'content');
        }
    }

    for (const assetPath of collectDependencyPaths(compiledContent.assets.all)) {
        addSource(assetPath, 'asset');
    }

    return [...sources.entries()]
        .map(([path, kind]) => ({ kind, path }))
        .toSorted((left, right) => left.path.localeCompare(right.path) || left.kind.localeCompare(right.kind));
}

export function collectDependencyPaths(dependencies: CompiledAssetDependencies): string[] {
    return [
        ...dependencies.audio,
        ...dependencies.audiosheets,
        ...dependencies.spritesheets,
        ...dependencies.textures,
    ];
}

export function collectItemAssetDependencies(
    items: Record<string, ItemManifestEntry> | undefined,
): CompiledAssetDependencies {
    const assets = createMutableAssetDependencies();

    for (const item of Object.values(items ?? {})) {
        addAsset(assets.textures, item.imageUrl);
    }

    return freezeAssetDependencies(assets);
}

export function compileContentManifest(input: CompileContentManifestInput): CompiledContentManifest {
    const globalAssets = mergeAssetDependencies(
        collectCharacterAssetDependencies(input.characters),
        collectItemAssetDependencies(input.items),
    );
    const byScene: Record<string, CompiledAssetDependencies> = {};
    const scenes: CompiledContentManifest['scenes'] = {};
    const normalizedScenes = Object.fromEntries(
        Object.entries(input.scenes).map(([sceneName, scene]) => [
            sceneName,
            normalizeSceneSource(scene),
        ]),
    );
    const graph = analyzeStoryGraph(
        Object.fromEntries(
            Object.entries(normalizedScenes).map(([sceneName, scene]) => [sceneName, scene.commands]),
        ),
        { startScene: input.manifest.startScene },
    );
    const nextScenesByScene = collectNextScenesByScene(graph.sceneEdges);

    for (const [sceneName, sceneSource] of Object.entries(normalizedScenes).toSorted(([left], [right]) => left.localeCompare(right))) {
        const dependencies = extractScriptAssetDependencies(sceneSource.commands, { macros: input.macros });
        byScene[sceneName] = dependencies;
        scenes[sceneName] = {
            commandCount: sceneSource.commands.length,
            dependencies,
            ...(sceneSource.localeNamespace ? { localeNamespace: sceneSource.localeNamespace } : {}),
            ...(nextScenesByScene[sceneName]?.length ? { nextScenes: nextScenesByScene[sceneName] } : {}),
            ...(sceneSource.schemaVersion ? { schemaVersion: sceneSource.schemaVersion } : {}),
        };
    }

    const allAssets = mergeAssetDependencies(
        globalAssets,
        ...Object.values(byScene),
    );

    const locales = input.locales && Object.keys(input.locales).length > 0
        ? summarizeLocales(input.locales)
        : undefined;

    return {
        $schema: 'zerith/compiled-content',
        assets: {
            all: allAssets,
            byScene,
            global: globalAssets,
        },
        compilerVersion: 1,
        ...(input.manifest.schemaVersion ? { contentSchemaVersion: input.manifest.schemaVersion } : {}),
        ...(locales ? { locales } : {}),
        scenes,
        source: {
            ...(input.manifest.startScene ? { startScene: input.manifest.startScene } : {}),
            ...(input.manifest.title ? { title: input.manifest.title } : {}),
            ...(input.manifest.version ? { version: input.manifest.version } : {}),
        },
    };
}

export function createEmptyCompiledAssetDependencies(): CompiledAssetDependencies {
    return freezeAssetDependencies(createMutableAssetDependencies());
}

export function extractScriptAssetDependencies(
    script: Script,
    options: ExtractScriptAssetDependenciesOptions = {},
): CompiledAssetDependencies {
    const assets = createMutableAssetDependencies();
    walkCommands(script, assets, options, new Set<string>());
    return freezeAssetDependencies(assets);
}

export function mergeAssetDependencies(...dependencies: CompiledAssetDependencies[]): CompiledAssetDependencies {
    const assets = createMutableAssetDependencies();

    for (const dependency of dependencies) {
        for (const assetUrl of dependency.audio) assets.audio.add(assetUrl);
        for (const assetUrl of dependency.audiosheets) assets.audiosheets.add(assetUrl);
        for (const assetUrl of dependency.spritesheets) assets.spritesheets.add(assetUrl);
        for (const assetUrl of dependency.textures) assets.textures.add(assetUrl);
    }

    return freezeAssetDependencies(assets);
}

function addAsset(target: Set<string>, assetUrl: string | undefined): void {
    const normalized = normalizeAssetUrl(assetUrl);
    if (normalized) target.add(normalized);
}

function addAudioReference(assets: MutableAssetDependencies, assetUrl: string | undefined): void {
    const cueReference = parseCueReference(assetUrl);
    if (cueReference) {
        addAsset(assets.audiosheets, cueReference.sheetUrl);
        return;
    }

    addAsset(assets.audio, assetUrl);
}

function addSpriteReference(assets: MutableAssetDependencies, assetUrl: string | undefined): void {
    const cueReference = parseCueReference(assetUrl);
    if (cueReference && looksLikeFileAsset(cueReference.sheetUrl)) {
        addAsset(assets.spritesheets, cueReference.sheetUrl);
        return;
    }

    if (!cueReference) {
        addAsset(assets.textures, assetUrl);
    }
}

function addVoiceReference(assets: MutableAssetDependencies, voice: unknown): void {
    addAudioReference(assets, toDialogueVoiceAssetReference(voice));
}

function collectNextScenesByScene(sceneEdges: Array<{ fromScene: string; targetScene: string }>): Record<string, string[]> {
    const grouped: Record<string, Set<string>> = {};

    for (const edge of sceneEdges) {
        const targets = grouped[edge.fromScene] ?? new Set<string>();
        targets.add(edge.targetScene);
        grouped[edge.fromScene] = targets;
    }

    return Object.fromEntries(
        Object.entries(grouped).map(([sceneName, targets]) => [
            sceneName,
            [...targets].toSorted((left, right) => left.localeCompare(right)),
        ]),
    );
}

function createMutableAssetDependencies(): MutableAssetDependencies {
    return {
        audio: new Set<string>(),
        audiosheets: new Set<string>(),
        spritesheets: new Set<string>(),
        textures: new Set<string>(),
    };
}

function freezeAssetDependencies(assets: MutableAssetDependencies): CompiledAssetDependencies {
    return {
        audio: sortAssets(assets.audio),
        audiosheets: sortAssets(assets.audiosheets),
        spritesheets: sortAssets(assets.spritesheets),
        textures: sortAssets(assets.textures),
    };
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function looksLikeFileAsset(assetUrl: string): boolean {
    return assetUrl.includes('/') || assetUrl.includes('\\') || assetUrl.includes('.');
}

function normalizeAssetUrl(assetUrl: string | undefined): string | undefined {
    const normalized = assetUrl?.trim();
    return normalized && normalized.length > 0 ? normalized : undefined;
}

function normalizeProjectCachePath(path: string | undefined): string | undefined {
    const normalized = path?.trim();
    if (!normalized || /^(?:[a-z]+:)?\/\//i.test(normalized) || normalized.startsWith('data:')) {
        return undefined;
    }

    return normalized
        .replaceAll('\\', '/')
        .replaceAll(/^\/+/g, '');
}

function normalizeSceneSource(scene: SceneFile | Script): SceneFile {
    return Array.isArray(scene)
        ? { commands: scene }
        : scene;
}

function parseCueReference(assetUrl: string | undefined): { cueName: string; sheetUrl: string } | undefined {
    const normalized = normalizeAssetUrl(assetUrl);
    if (!normalized || !normalized.includes(':') || /^[a-z][a-z+.-]*:\/\//i.test(normalized) || normalized.startsWith('data:')) {
        return undefined;
    }

    const separatorIndex = normalized.lastIndexOf(':');
    if (separatorIndex <= 0 || separatorIndex >= normalized.length - 1) {
        return undefined;
    }

    const sheetUrl = normalized.slice(0, separatorIndex);
    const cueName = normalized.slice(separatorIndex + 1);
    return sheetUrl && cueName ? { cueName, sheetUrl } : undefined;
}

function sortAssets(values: Set<string>): string[] {
    return [...values].toSorted((left, right) => left.localeCompare(right));
}

function summarizeLocales(locales: Record<string, LocaleBundle>): CompiledContentManifest['locales'] {
    return Object.fromEntries(
        Object.entries(locales)
            .toSorted(([left], [right]) => left.localeCompare(right))
            .map(([locale, bundle]) => [
                locale,
                {
                    entryCount: Object.values(bundle.namespaces).reduce((total, namespace) => total + Object.keys(namespace).length, 0),
                    namespaces: Object.keys(bundle.namespaces).toSorted((left, right) => left.localeCompare(right)),
                },
            ]),
    );
}

function walkCommand(
    command: BaseCommand,
    assets: MutableAssetDependencies,
    options: ExtractScriptAssetDependenciesOptions,
    activeMacros: Set<string>,
): void {
    if (command.type === 'background' || command.type === 'scene_change') {
        addAsset(assets.textures, typeof command.assetUrl === 'string' ? command.assetUrl : undefined);
    }

    if (command.type === 'bgm' || command.type === 'sfx') {
        addAudioReference(assets, typeof command.assetUrl === 'string' ? command.assetUrl : undefined);
    }

    if (command.type === 'dialogue') {
        addVoiceReference(assets, command.voice);
    }

    if (command.type === 'sprite') {
        addSpriteReference(assets, typeof command.assetUrl === 'string' ? command.assetUrl : undefined);
    }

    if (command.type === 'call' && typeof command.name === 'string') {
        walkMacro(command.name, assets, options, activeMacros);
    }

    for (const key of COMMAND_COLLECTION_KEYS) {
        const nestedCommands = command[key];
        if (Array.isArray(nestedCommands)) {
            walkCommands(nestedCommands as BaseCommand[], assets, options, activeMacros);
        }
    }

    const optionsValue = command.options;
    if (Array.isArray(optionsValue)) {
        for (const option of optionsValue) {
            if (isRecord(option) && Array.isArray(option.commands)) {
                walkCommands(option.commands as BaseCommand[], assets, options, activeMacros);
            }
        }
    }
}

function walkCommands(
    commands: BaseCommand[],
    assets: MutableAssetDependencies,
    options: ExtractScriptAssetDependenciesOptions,
    activeMacros: Set<string>,
): void {
    for (const command of commands) {
        walkCommand(command, assets, options, activeMacros);
    }
}

function walkMacro(
    macroName: string,
    assets: MutableAssetDependencies,
    options: ExtractScriptAssetDependenciesOptions,
    activeMacros: Set<string>,
): void {
    if (activeMacros.has(macroName)) return;

    const macro = options.macros?.[macroName];
    if (!macro) return;

    activeMacros.add(macroName);
    walkCommands(macro, assets, options, activeMacros);
    activeMacros.delete(macroName);
}
