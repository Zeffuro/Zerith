import { bootstrapEngine, type GameManifest, resolveManifestValue, resolveScenes, type Script, validateScript } from 'core';

async function bootstrap() {
    const canvas = document.querySelector('#game-canvas') as HTMLCanvasElement;

    const manifest = await fetch('/game.json').then(r => r.json() as Promise<GameManifest>);

    const [characters, items, macros, scenes] = await Promise.all([
        manifest.characters ? resolveManifestValue(manifest.characters) : Promise.resolve({}),
        manifest.items ? resolveManifestValue(manifest.items) : Promise.resolve({}),
        manifest.macros ? resolveManifestValue(manifest.macros) : Promise.resolve({}),
        manifest.scenes ? resolveScenes(manifest.scenes) : Promise.resolve({}),
    ]);

    const validatedScenes: Record<string, Script> = {};
    for (const [name, script] of Object.entries(scenes)) {
        validatedScenes[name] = validateScript(script as unknown[]) as Script;
    }

    const engine = await bootstrapEngine({
        canvas,
        characters,
        config: {
            audio: {
                bgmVolume: 0.8,
                masterVolume: 1,
                sfxVolume: 1,
                voiceVolume: 1
            },
            display: { height: 720, scaleMode: 'fit', width: 1280 },
            startScreen: {
                backgroundAlpha: 0.9,
                backgroundColor: 0x00_00_00,
                text: 'CLICK TO START'
            },
            theme: {
                accentColor: 0xFF_AA_AA,
                borderColor: 0xAA_AA_FF,
                borderWidth: 4,
                boxAlpha: 0.9,
                boxColor: 0x00_00_33,
                fontFamily: 'Courier New',
                fontSize: 24,
                hoverColor: 0x33_33_99
            }
        },
        defaultBlipUrl: '/assets/sfx/blip.wav',
        items,
        macros,
        manifest,
        preloadAssets: true,
        scenes: validatedScenes,
    });

    const startScene = manifest.startScene ?? 'intro';
    await engine.startScreen.show(startScene);
    engine.start();
}

await bootstrap();