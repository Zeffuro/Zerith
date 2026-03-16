import {
    bootstrapEngine,
    type Engine,
    type EngineConfig,
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
    defaultBlipUrl?: string;
    manifestUrl?: string;
    preloadAssets?: boolean;
}

export async function bootstrapPlayer(options: PlayerBootstrapOptions): Promise<Engine> {
    const {
        baseUrl = new URL(import.meta.env.BASE_URL, globalThis.location.href).toString(),
        canvas,
        config = defaultConfig,
        defaultBlipUrl = 'assets/sfx/blip.wav',
        manifestUrl = 'game.json',
        preloadAssets = true,
    } = options;

    const manifest = await loadManifest(resolveRuntimeUrl(manifestUrl, baseUrl));

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
        validatedScenes[name] = validateScript(script as unknown[]) as Script;
    }

    const engine = await bootstrapEngine({
        assetResolver: (url) => resolveRuntimeUrl(url, baseUrl),
        canvas,
        characters,
        config,
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

export async function loadManifest(manifestUrl: string): Promise<GameManifest> {
    const response = await fetch(manifestUrl);
    if (!response.ok) {
        throw new Error(`Failed to load game manifest from ${manifestUrl} (${response.status}).`);
    }

    return response.json() as Promise<GameManifest>;
}

function resolveRuntimeUrl(assetPath: string, baseUrl: string): string {
    if (/^(?:[a-z]+:)?\/\//i.test(assetPath) || assetPath.startsWith('data:')) {
        return assetPath;
    }

    const sanitizedPath = assetPath.startsWith('/') ? assetPath.slice(1) : assetPath;
    const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
    return new URL(sanitizedPath, normalizedBase).toString();
}

