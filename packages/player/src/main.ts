import { bootstrapEngine, validateScript, resolveManifestValue, resolveScenes, type GameManifest } from 'core';

async function bootstrap() {
    const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;

    const manifest: GameManifest = await fetch('/game.json').then(r => r.json());

    const [characters, items, macros, scenes] = await Promise.all([
        manifest.characters ? resolveManifestValue(manifest.characters) : Promise.resolve({}),
        manifest.items ? resolveManifestValue(manifest.items) : Promise.resolve({}),
        manifest.macros ? resolveManifestValue(manifest.macros) : Promise.resolve({}),
        manifest.scenes ? resolveScenes(manifest.scenes) : Promise.resolve({}),
    ]);

    const validatedScenes: Record<string, any[]> = {};
    for (const [name, script] of Object.entries(scenes)) {
        validatedScenes[name] = validateScript(script as unknown[]);
    }

    const engine = await bootstrapEngine({
        canvas,
        config: {
            display: { width: 1280, height: 720, scaleMode: 'fit' },
            audio: {
                bgmVolume: 0.8,
                sfxVolume: 1.0,
                voiceVolume: 1.0,
                masterVolume: 1.0
            },
            theme: {
                fontFamily: 'Courier New',
                fontSize: 24,
                boxColor: 0x000033,
                boxAlpha: 0.9,
                borderColor: 0xaaaaff,
                borderWidth: 4,
                accentColor: 0xffaaaa,
                hoverColor: 0x333399
            },
            startScreen: {
                text: 'CLICK TO START',
                backgroundColor: 0x000000,
                backgroundAlpha: 0.9
            }
        },
        manifest,
        characters,
        items,
        macros,
        scenes: validatedScenes,
        preloadAssets: true,
        defaultBlipUrl: '/assets/sfx/blip.wav',
    });

    const startScene = manifest.startScene ?? 'intro';
    await engine.startScreen.show(startScene);
}

await bootstrap();