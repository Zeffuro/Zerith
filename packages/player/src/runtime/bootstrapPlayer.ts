import {
    bootstrapEngine,
    type Engine,
    type EngineConfig,
    EngineConfigSchema,
    type GameManifest,
    resolveManifestValue,
    resolveScenes,
    type Script,
    validateScript,
} from 'core';

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
        fontFamily: 'Courier New',
        fontSize: 24,
        hoverColor: 0x33_33_99,
    },
};

export interface PlayerBootstrapOptions {
    baseUrl?: string;
    canvas: HTMLCanvasElement;
    config?: EngineConfig;
    configUrl?: false | string;
    defaultBlipUrl?: string;
    manifestUrl?: string;
    preloadAssets?: boolean;
}

export async function bootstrapPlayer(options: PlayerBootstrapOptions): Promise<Engine> {
    const {
        baseUrl = new URL(import.meta.env.BASE_URL, globalThis.location.href).toString(),
        canvas,
        config,
        configUrl = 'engine.config.json',
        defaultBlipUrl = 'assets/sfx/blip.wav',
        manifestUrl = 'game.json',
        preloadAssets = true,
    } = options;

    const manifest = await loadManifest(resolveRuntimeUrl(manifestUrl, baseUrl));
    const loadedConfig = configUrl === false
        ? undefined
        : await loadEngineConfig(resolveRuntimeUrl(configUrl, baseUrl));
    const effectiveConfig = mergeEngineConfigs(defaultConfig, loadedConfig, config);

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
    for (const [name, script] of Object.entries(scenes)) {
        validatedScenes[name] = validateScript(script as unknown[]);
    }

    const engine = await bootstrapEngine({
        assetResolver: (url) => resolveRuntimeUrl(url, baseUrl),
        canvas,
        characters,
        config: effectiveConfig,
        defaultBlipUrl: resolveRuntimeUrl(defaultBlipUrl, baseUrl),
        items,
        macros,
        manifest,
        preloadAssets,
        scenes: validatedScenes,
    });

    const startScene = manifest.startScene ?? 'intro';
    await engine.startScreen.show(startScene);
    engine.start();

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

function mergeEngineConfigs(...configs: (EngineConfig | undefined)[]): EngineConfig {
    const merged: EngineConfig = {};

    for (const config of configs) {
        if (!config) continue;

        const audio = merged.audio;
        const display = merged.display;
        const input = merged.input;
        const notifications = merged.notifications;
        const overlay = merged.overlay;
        const preview = merged.preview;
        const startScreen = merged.startScreen;
        const theme = merged.theme;

        Object.assign(merged, config);
        merged.audio = { ...audio, ...config.audio };
        merged.display = { ...display, ...config.display };
        merged.input = { ...input, ...config.input };
        merged.notifications = { ...notifications, ...config.notifications };
        merged.overlay = { ...overlay, ...config.overlay };
        merged.preview = { ...preview, ...config.preview };
        merged.startScreen = { ...startScreen, ...config.startScreen };
        merged.theme = { ...theme, ...config.theme };
    }

    return merged;
}

function resolveRuntimeUrl(assetPath: string, baseUrl: string): string {
    if (/^(?:[a-z]+:)?\/\//i.test(assetPath) || assetPath.startsWith('data:')) {
        return assetPath;
    }

    const sanitizedPath = assetPath.startsWith('/') ? assetPath.slice(1) : assetPath;
    const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
    return new URL(sanitizedPath, normalizedBase).toString();
}

