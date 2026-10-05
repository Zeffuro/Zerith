import {
    bootstrapEngine,
    type Engine,
    type EngineConfig,
    EngineConfigSchema,
    type GameManifest,
    parseSceneFile,
    resolveManifestValue,
    resolveScenes,
    type Script,
} from '@zeffuro/zerith-core';

import { mergeEngineConfigs } from './bootstrapConfig';
import {
    createRuntimeContentPrefetcher,
    loadCompiledContentManifest,
} from './compiledContentPrefetch';
import { createPlayerDisplayControls } from './desktopDisplayControls';
import { resolveDesktopPlayer } from './desktopPlayer';
import { configurePlayerAccessibilityShell } from './playerAccessibility';
import { resolvePlayerBaseUrl } from './playerBaseUrl';
import { createDefaultPlayerPreferences, createPlayerPreferenceConfig, readPlayerPreferences } from './playerPreferences';
import { createDefaultPlayerShell, type PlayerShell, type PlayerShellContext } from './playerShell';
import { normalizePlayerShellConfig } from './playerShellConfig';
import { createPlayerStorage } from './playerStorage';

const defaultConfig: EngineConfig = {
    audio: {
        bgmVolume: 0.8,
        masterVolume: 1,
        sfxVolume: 1,
        voiceVolume: 1,
    },
    display: { height: 720, scaleMode: 'fit', width: 1280 },
    startScreen: {
        backgroundAlpha: 0.9,
        backgroundColor: 0x00_00_00,
        text: 'CLICK TO START',
    },
    theme: {
        accentColor: 0xFF_AA_AA,
        borderColor: 0xAA_AA_FF,
        borderWidth: 4,
        boxAlpha: 0.9,
        boxColor: 0x00_00_33,
        fontFamily: 'Arial',
        fontSize: 24,
        hoverColor: 0x33_33_99,
    },
};

export interface PlayerBootstrapOptions {
    baseUrl?: string;
    canvas: HTMLCanvasElement;
    compiledContentUrl?: false | string;
    config?: EngineConfig;
    configUrl?: false | string;
    defaultBlipUrl?: null | string;
    manifestUrl?: string;
    prefetchCompiledAssets?: boolean;
    preloadAssets?: boolean;
    shell?: ((context: PlayerShellContext) => PlayerShell) | false;
}

export async function bootstrapPlayer(options: PlayerBootstrapOptions): Promise<Engine> {
    const {
        baseUrl = resolvePlayerBaseUrl(),
        canvas,
        compiledContentUrl = 'zerith.content.json',
        config,
        configUrl = 'engine.config.json',
        defaultBlipUrl,
        manifestUrl = 'game.json',
        prefetchCompiledAssets = true,
        preloadAssets = true,
    } = options;

    const manifest = await loadManifest(resolveRuntimeUrl(manifestUrl, baseUrl));
    const compiledContent = compiledContentUrl === false
        ? undefined
        : await loadCompiledContentManifest(resolveRuntimeUrl(compiledContentUrl, baseUrl));
    const loadedConfig = configUrl === false
        ? undefined
        : await loadEngineConfig(resolveRuntimeUrl(configUrl, baseUrl));
    const authoredConfig = mergeEngineConfigs(defaultConfig, loadedConfig, config);
    const shellConfig = normalizePlayerShellConfig(authoredConfig.player, manifest.title);
    const useShell = options.shell !== false && shellConfig.enabled;
    const defaults = createDefaultPlayerPreferences(authoredConfig);
    authoredConfig.storage = createPlayerStorage(manifest, authoredConfig.storage);
    const savedPreferences = readPlayerPreferences(useShell && shellConfig.rememberSettings ? authoredConfig.storage : undefined, defaults);
    const effectiveConfig = useShell ? createPlayerPreferenceConfig(authoredConfig, savedPreferences.preferences) : authoredConfig;
    await loadPlayerFont(effectiveConfig, baseUrl);

    const resolvedCharacters = typeof manifest.characters === 'string'
        ? resolveRuntimeUrl(manifest.characters, baseUrl)
        : manifest.characters;
    const resolvedItems = typeof manifest.items === 'string'
        ? resolveRuntimeUrl(manifest.items, baseUrl)
        : manifest.items;
    const resolvedMacros = typeof manifest.macros === 'string'
        ? resolveRuntimeUrl(manifest.macros, baseUrl)
        : manifest.macros;
    const resolvedScenes = manifest.scenes
        ? Object.fromEntries(Object.entries(manifest.scenes).map(([name, scene]) => [
            name,
            typeof scene === 'string' ? resolveRuntimeUrl(scene, baseUrl) : scene,
        ]))
        : undefined;

    const [characters, items, macros, scenes] = await Promise.all([
        resolvedCharacters ? resolveManifestValue(resolvedCharacters) : Promise.resolve({}),
        resolvedItems ? resolveManifestValue(resolvedItems) : Promise.resolve({}),
        resolvedMacros ? resolveManifestValue(resolvedMacros) : Promise.resolve({}),
        resolvedScenes ? resolveScenes(resolvedScenes) : Promise.resolve({}),
    ]);

    const validatedScenes: Record<string, Script> = {};
    for (const [name, sceneFile] of Object.entries(scenes)) {
        validatedScenes[name] = parseSceneFile(sceneFile, { sceneName: name }).commands;
    }

    const accessibilityShell = configurePlayerAccessibilityShell(canvas, effectiveConfig, { alwaysCreateLiveRegion: useShell, label: manifest.title });
    let engine: Engine;
    try { engine = await bootstrapEngine({
        assetResolver: (url) => resolveRuntimeUrl(url, baseUrl),
        canvas,
        characters,
        config: accessibilityShell.config,
        defaultBlipUrl: defaultBlipUrl === undefined || defaultBlipUrl === null
            ? defaultBlipUrl
            : resolveRuntimeUrl(defaultBlipUrl, baseUrl),
        items,
        macros,
        manifest,
        preloadAssets,
        scenes: validatedScenes,
    }); } catch (error) { accessibilityShell.dispose(); throw error; }

    const startScene = manifest.startScene ?? 'intro';
    const prefetcher = prefetchCompiledAssets && compiledContent
        ? createRuntimeContentPrefetcher({
            compiledContent,
            resolveAssetUrl: (assetUrl) => resolveRuntimeUrl(assetUrl, baseUrl),
            scripts: validatedScenes,
        })
        : undefined;
    const onSceneLoaded = (sceneName: string) => {
        prefetcher?.prefetchLikelyNextScenes(sceneName);
    };

    prefetcher?.prefetchGlobalAndScene(startScene);
    engine.events.on('scene:loaded', onSceneLoaded);
    const destroyEngine = engine.destroy.bind(engine);
    const display = typeof document === 'undefined' ? undefined : createPlayerDisplayControls(resolveDesktopPlayer(globalThis));
    let shell: PlayerShell | undefined;
    engine.destroy = () => {
        shell?.dispose();
        display?.dispose();
        engine.events.off('scene:loaded', onSceneLoaded);
        prefetcher?.dispose();
        accessibilityShell.dispose();
        destroyEngine();
    };

    try {
        if (useShell && display) {
            shell = (options.shell || createDefaultPlayerShell)({
                baseUrl, canvas, config: shellConfig, defaults, display, engine,
                preferences: savedPreferences.preferences, startScene, warning: savedPreferences.warning,
            });
            await shell.start();
        } else {
            await engine.startScreen.show(startScene);
            engine.start();
        }
    } catch (error) { engine.destroy(); throw error; }

    return engine;
}

export async function loadEngineConfig(configUrl: string): Promise<EngineConfig | undefined> {
    const response = await fetch(configUrl);

    if (response.status === 404) {
        return undefined;
    }

    if (!response.ok) {
        throw new Error(`Failed to load engine config from ${configUrl} (${response.status}).`);
    }

    const result = EngineConfigSchema.safeParse(await response.json());
    if (!result.success) {
        console.warn('[player] Ignoring invalid engine.config.json:', result.error.issues[0]?.message ?? 'schema validation failed');
        return undefined;
    }

    return result.data as EngineConfig;
}

export async function loadManifest(manifestUrl: string): Promise<GameManifest> {
    const response = await fetch(manifestUrl);
    if (!response.ok) {
        throw new Error(`Failed to load game manifest from ${manifestUrl} (${response.status}).`);
    }

    return response.json() as Promise<GameManifest>;
}

async function loadPlayerFont(config: EngineConfig, baseUrl: string): Promise<void> {
    const family = config.theme?.fontFamily;
    const asset = config.preview?.fontAssetUrl;
    if (!family || !asset || typeof FontFace === 'undefined') return;
    try {
        const font = new FontFace(family, `url(${JSON.stringify(resolveRuntimeUrl(asset, baseUrl))})`);
        document.fonts.add(await font.load());
    } catch { console.warn('[player] The game font could not be loaded. Using a fallback font.'); }
}

function resolveRuntimeUrl(assetPath: string, baseUrl: string): string {
    if (/^(?:[a-z]+:)?\/\//i.test(assetPath) || assetPath.startsWith('data:')) {
        return assetPath;
    }

    const sanitizedPath = assetPath.startsWith('/') ? assetPath.slice(1) : assetPath;
    const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
    return new URL(sanitizedPath, normalizedBase).toString();
}

