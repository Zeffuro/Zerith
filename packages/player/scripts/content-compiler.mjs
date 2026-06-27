import fs from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';

const COMPILED_CONTENT_FILE = 'zerith.content.json';

export function compileGameContent(gamePath, options = {}) {
    const cachePolicy = normalizeCachePolicy(options.cachePolicy);
    const manifest = readJson(path.join(gamePath, 'game.json'));
    const characters = readManifestValue(gamePath, manifest.characters, {});
    const items = readManifestValue(gamePath, manifest.items, {});
    const macros = readManifestValue(gamePath, manifest.macros, {});
    const scenes = readScenes(gamePath, manifest.scenes ?? {});
    const locales = readLocales(gamePath, manifest.localization?.locales ?? {});

    const globalAssets = hydrateDescriptorSources(gamePath, mergeAssetDependencies(
        collectCharacterAssetDependencies(characters),
        collectItemAssetDependencies(items),
    ));
    const byScene = {};
    const sceneSummaries = {};

    for (const [sceneName, scene] of Object.entries(scenes).sort(([left], [right]) => left.localeCompare(right))) {
        const sceneSource = normalizeSceneSource(scene);
        const dependencies = hydrateDescriptorSources(
            gamePath,
            extractScriptAssetDependencies(sceneSource.commands, { macros }),
        );
        byScene[sceneName] = dependencies;
        sceneSummaries[sceneName] = {
            commandCount: sceneSource.commands.length,
            dependencies,
            ...(sceneSource.localeNamespace ? { localeNamespace: sceneSource.localeNamespace } : {}),
            ...(sceneSource.schemaVersion ? { schemaVersion: sceneSource.schemaVersion } : {}),
        };
    }

    const compiled = {
        $schema: 'zerith/compiled-content',
        assets: {
            all: mergeAssetDependencies(globalAssets, ...Object.values(byScene)),
            byScene,
            global: globalAssets,
        },
        compilerVersion: 1,
        ...(manifest.schemaVersion ? { contentSchemaVersion: manifest.schemaVersion } : {}),
        ...(Object.keys(locales).length > 0 ? { locales: summarizeLocales(locales) } : {}),
        scenes: sceneSummaries,
        source: {
            ...(manifest.startScene ? { startScene: manifest.startScene } : {}),
            ...(manifest.title ? { title: manifest.title } : {}),
            ...(manifest.version ? { version: manifest.version } : {}),
        },
    };

    return cachePolicy === 'none'
        ? compiled
        : attachCacheManifest(gamePath, manifest, compiled);
}

export function writeCompiledContentManifest(gamePath, outputPath, options = {}) {
    const compiled = compileGameContent(gamePath, options);
    const artifactPath = path.join(outputPath, COMPILED_CONTENT_FILE);
    fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
    fs.writeFileSync(artifactPath, `${JSON.stringify(compiled, undefined, 2)}\n`);
    return { artifactPath, compiled };
}

function addAsset(target, assetUrl) {
    const normalized = normalizeAssetUrl(assetUrl);
    if (normalized) target.add(normalized);
}

function addCacheEntry(entries, gamePath, source) {
    if (entries[source.path]) return;

    const filePath = resolveProjectFilePath(gamePath, gamePath, source.path);
    if (!filePath || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
        return;
    }

    const bytes = fs.readFileSync(filePath);
    entries[source.path] = {
        hash: createHash('sha256').update(bytes).digest('hex'),
        kind: source.kind,
        size: bytes.byteLength,
    };
}

function addCacheSource(sources, sourcePath, kind) {
    const normalizedPath = normalizeProjectCachePath(sourcePath);
    if (!normalizedPath) return;

    sources.set(normalizedPath, kind);
}

function addAudioReference(assets, assetUrl) {
    const cueReference = parseCueReference(assetUrl);
    if (cueReference) {
        addAsset(assets.audiosheets, cueReference.sheetUrl);
        return;
    }

    addAsset(assets.audio, assetUrl);
}

function attachCacheManifest(gamePath, manifest, compiled) {
    const entries = {};
    for (const source of collectCacheSources(manifest, compiled)) {
        addCacheEntry(entries, gamePath, source);
    }
    addCacheEntry(entries, gamePath, { kind: 'content', path: 'engine.config.json' });

    return {
        ...compiled,
        cache: {
            algorithm: 'sha256',
            entries: sortRecord(entries),
        },
    };
}

function collectCacheSources(manifest, compiled) {
    const sources = new Map();

    addCacheSource(sources, 'game.json', 'content');
    addCacheSource(sources, manifest.characters, 'content');
    addCacheSource(sources, manifest.items, 'content');
    addCacheSource(sources, manifest.macros, 'content');

    for (const scene of Object.values(isRecord(manifest.scenes) ? manifest.scenes : {})) {
        if (typeof scene === 'string') {
            addCacheSource(sources, scene, 'content');
        }
    }

    const locales = isRecord(manifest.localization) && isRecord(manifest.localization.locales)
        ? manifest.localization.locales
        : {};
    for (const locale of Object.values(locales)) {
        if (typeof locale === 'string') {
            addCacheSource(sources, locale, 'content');
        }
    }

    for (const assetPath of collectDependencyPaths(compiled.assets.all)) {
        addCacheSource(sources, assetPath, 'asset');
    }

    return [...sources.entries()]
        .map(([sourcePath, kind]) => ({ kind, path: sourcePath }))
        .sort((left, right) => left.path.localeCompare(right.path) || left.kind.localeCompare(right.kind));
}

function collectDependencyPaths(dependencies) {
    return [
        ...dependencies.audio,
        ...dependencies.audiosheets,
        ...dependencies.spritesheets,
        ...dependencies.textures,
    ];
}

function addSpriteReference(assets, assetUrl) {
    const cueReference = parseCueReference(assetUrl);
    if (cueReference && looksLikeFileAsset(cueReference.sheetUrl)) {
        addAsset(assets.spritesheets, cueReference.sheetUrl);
        return;
    }

    if (!cueReference) {
        addAsset(assets.textures, assetUrl);
    }
}

function addVoiceReference(assets, voice) {
    if (typeof voice === 'string') {
        addAudioReference(assets, voice);
        return;
    }

    if (!isRecord(voice)) return;

    const assetUrl = typeof voice.assetUrl === 'string' ? voice.assetUrl : undefined;
    const cue = typeof voice.cue === 'string' ? voice.cue : undefined;
    addAudioReference(assets, assetUrl && cue ? `${assetUrl}:${cue}` : assetUrl);
}

function collectCharacterAssetDependencies(characters) {
    const assets = createMutableAssetDependencies();

    for (const character of Object.values(isRecord(characters) ? characters : {})) {
        if (!isRecord(character)) continue;
        addAsset(assets.textures, character.portraitUrl);
        addAsset(assets.audio, character.blipUrl);
        if (isRecord(character.spritesheet)) {
            addAsset(assets.spritesheets, character.spritesheet.atlasUrl);
        }
    }

    return freezeAssetDependencies(assets);
}

function collectItemAssetDependencies(items) {
    const assets = createMutableAssetDependencies();

    for (const item of Object.values(isRecord(items) ? items : {})) {
        if (isRecord(item)) {
            addAsset(assets.textures, item.imageUrl);
        }
    }

    return freezeAssetDependencies(assets);
}

function createMutableAssetDependencies() {
    return {
        audio: new Set(),
        audiosheets: new Set(),
        spritesheets: new Set(),
        textures: new Set(),
    };
}

function extractScriptAssetDependencies(script, options = {}) {
    const assets = createMutableAssetDependencies();
    walkCommands(Array.isArray(script) ? script : [], assets, options, new Set());
    return freezeAssetDependencies(assets);
}

function freezeAssetDependencies(assets) {
    return {
        audio: sortAssets(assets.audio),
        audiosheets: sortAssets(assets.audiosheets),
        spritesheets: sortAssets(assets.spritesheets),
        textures: sortAssets(assets.textures),
    };
}

function hydrateDescriptorSources(gamePath, dependencies) {
    const assets = toMutableAssetDependencies(dependencies);

    for (const sheetUrl of dependencies.audiosheets) {
        const descriptor = readAssetJson(gamePath, sheetUrl);
        if (isRecord(descriptor) && typeof descriptor.source === 'string') {
            addAsset(assets.audio, resolveSheetSource(sheetUrl, descriptor.source));
        }
    }

    for (const sheetUrl of dependencies.spritesheets) {
        const descriptor = readAssetJson(gamePath, sheetUrl);
        const source = isRecord(descriptor)
            ? typeof descriptor.source === 'string'
                ? descriptor.source
                : isRecord(descriptor.meta) && typeof descriptor.meta.image === 'string'
                    ? descriptor.meta.image
                    : undefined
            : undefined;
        addAsset(assets.textures, source ? resolveSheetSource(sheetUrl, source) : undefined);
    }

    return freezeAssetDependencies(assets);
}

function isRecord(value) {
    return typeof value === 'object' && value !== null;
}

function looksLikeFileAsset(assetUrl) {
    return assetUrl.includes('/') || assetUrl.includes('\\') || assetUrl.includes('.');
}

function mergeAssetDependencies(...dependencies) {
    const assets = createMutableAssetDependencies();

    for (const dependency of dependencies) {
        for (const assetUrl of dependency.audio) assets.audio.add(assetUrl);
        for (const assetUrl of dependency.audiosheets) assets.audiosheets.add(assetUrl);
        for (const assetUrl of dependency.spritesheets) assets.spritesheets.add(assetUrl);
        for (const assetUrl of dependency.textures) assets.textures.add(assetUrl);
    }

    return freezeAssetDependencies(assets);
}

function normalizeAssetUrl(assetUrl) {
    const normalized = typeof assetUrl === 'string' ? assetUrl.trim() : undefined;
    return normalized && normalized.length > 0 ? normalized : undefined;
}

function normalizeCachePolicy(cachePolicy) {
    const normalized = cachePolicy ?? 'hashed';
    if (normalized === 'hashed' || normalized === 'none') {
        return normalized;
    }

    throw new Error(`Unsupported cache policy: ${String(cachePolicy)}`);
}

function normalizeProjectCachePath(sourcePath) {
    const normalized = typeof sourcePath === 'string' ? sourcePath.trim() : undefined;
    if (!normalized || /^(?:[a-z]+:)?\/\//i.test(normalized) || normalized.startsWith('data:')) {
        return undefined;
    }

    return normalized
        .replaceAll('\\', '/')
        .replaceAll(/^\/+/g, '');
}

function normalizeSceneSource(scene) {
    return Array.isArray(scene)
        ? { commands: scene }
        : scene;
}

function parseCueReference(assetUrl) {
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

function readAssetJson(gamePath, assetUrl) {
    const filePath = resolveProjectFilePath(gamePath, gamePath, assetUrl);
    return filePath && fs.existsSync(filePath) ? readJson(filePath) : undefined;
}

function readJson(filePath) {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function readLocales(gamePath, locales) {
    if (!isRecord(locales)) return {};

    return Object.fromEntries(
        Object.entries(locales).map(([locale, value]) => [
            locale,
            typeof value === 'string' ? readJson(resolveProjectFilePath(gamePath, gamePath, value)) : value,
        ]),
    );
}

function readManifestValue(gamePath, value, fallback) {
    if (typeof value === 'string') {
        return readJson(resolveProjectFilePath(gamePath, gamePath, value));
    }

    return value ?? fallback;
}

function readScenes(gamePath, scenes) {
    return Object.fromEntries(
        Object.entries(scenes).map(([sceneName, scene]) => [
            sceneName,
            typeof scene === 'string' ? readJson(resolveProjectFilePath(gamePath, gamePath, scene)) : scene,
        ]),
    );
}

function resolveProjectFilePath(gamePath, baseDirectory, assetUrl) {
    if (!assetUrl || /^(?:[a-z]+:)?\/\//i.test(assetUrl) || assetUrl.startsWith('data:')) {
        return undefined;
    }

    const normalized = assetUrl.startsWith('/') ? assetUrl.slice(1) : assetUrl;
    return path.resolve(assetUrl.startsWith('/') ? gamePath : baseDirectory, normalized);
}

function resolveSheetSource(sheetUrl, source) {
    if (source.startsWith('/') || /^(?:[a-z]+:)?\/\//i.test(source) || source.startsWith('data:')) {
        return source;
    }

    const directory = sheetUrl.slice(0, Math.max(0, sheetUrl.lastIndexOf('/') + 1));
    return `${directory}${source}`;
}

function sortAssets(values) {
    return [...values].sort((left, right) => left.localeCompare(right));
}

function sortRecord(record) {
    return Object.fromEntries(
        Object.entries(record)
            .sort(([left], [right]) => left.localeCompare(right)),
    );
}

function summarizeLocales(locales) {
    return Object.fromEntries(
        Object.entries(locales)
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([locale, bundle]) => {
                const namespaces = isRecord(bundle?.namespaces) ? bundle.namespaces : {};
                return [
                    locale,
                    {
                        entryCount: Object.values(namespaces)
                            .filter(isRecord)
                            .reduce((total, namespace) => total + Object.keys(namespace).length, 0),
                        namespaces: Object.keys(namespaces).sort((left, right) => left.localeCompare(right)),
                    },
                ];
            }),
    );
}

function toMutableAssetDependencies(dependencies) {
    return {
        audio: new Set(dependencies.audio),
        audiosheets: new Set(dependencies.audiosheets),
        spritesheets: new Set(dependencies.spritesheets),
        textures: new Set(dependencies.textures),
    };
}

function walkCommand(command, assets, options, activeMacros) {
    if (!isRecord(command)) return;

    if (command.type === 'background' || command.type === 'scene_change') {
        addAsset(assets.textures, command.assetUrl);
    }

    if (command.type === 'bgm' || command.type === 'sfx') {
        addAudioReference(assets, command.assetUrl);
    }

    if (command.type === 'dialogue') {
        addVoiceReference(assets, command.voice);
    }

    if (command.type === 'sprite') {
        addSpriteReference(assets, command.assetUrl);
    }

    if (command.type === 'call' && typeof command.name === 'string') {
        walkMacro(command.name, assets, options, activeMacros);
    }

    for (const key of ['body', 'commands', 'onFalse', 'onTrue']) {
        if (Array.isArray(command[key])) {
            walkCommands(command[key], assets, options, activeMacros);
        }
    }

    if (Array.isArray(command.options)) {
        for (const option of command.options) {
            if (isRecord(option) && Array.isArray(option.commands)) {
                walkCommands(option.commands, assets, options, activeMacros);
            }
        }
    }
}

function walkCommands(commands, assets, options, activeMacros) {
    for (const command of commands) {
        walkCommand(command, assets, options, activeMacros);
    }
}

function walkMacro(macroName, assets, options, activeMacros) {
    if (activeMacros.has(macroName)) return;

    const macro = options.macros?.[macroName];
    if (!Array.isArray(macro)) return;

    activeMacros.add(macroName);
    walkCommands(macro, assets, options, activeMacros);
    activeMacros.delete(macroName);
}
