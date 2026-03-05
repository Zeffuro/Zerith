import { Engine, BuiltInHandlers, DialogueHandler, ChoiceHandler, validateScript, resolveManifestValue, resolveScenes, type GameManifest } from 'core';

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

    const engine = new Engine({
        display: {
            width: 1280,
            height: 720,
            scaleMode: 'fit'
        },
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
    });

    manifest.characters = characters;
    engine.manifest = manifest;

    // Preload character assets
    if (Object.keys(characters).length > 0) {
        const { Assets } = await import('pixi.js');
        const { sound } = await import('@pixi/sound');

        const promises: Promise<any>[] = [];
        for (const [, char] of Object.entries(characters) as [string, any][]) {
            // Preload portrait (if standalone image)
            if (char.portraitUrl) {
                promises.push(Assets.load(char.portraitUrl).catch(() => {}));
            }
            // Preload blip sound
            if (char.blipUrl && !sound.exists(char.blipUrl)) {
                promises.push(new Promise<void>(resolve => {
                    sound.add(char.blipUrl, {
                        url: char.blipUrl,
                        preload: true,
                        loaded: () => resolve()
                    });
                }));
            }
            // Preload spritesheet
            if (char.spritesheet?.atlasUrl) {
                promises.push(engine.spritesheets.load(char.spritesheet).catch((err) => {
                    console.warn(`Failed to preload spritesheet: ${char.spritesheet.atlasUrl}`, err);
                }));
            }
        }
        await Promise.all(promises);
    }

    // Load items
    if (items && Object.keys(items).length > 0) {
        engine.items.loadDefinitions(items);
    }

    engine.registerHandlers(BuiltInHandlers);
    engine.registerHandler(new DialogueHandler({
        ...engine.theme,
        characters,
        defaultBlipUrl: '/assets/sfx/blip.wav'
    }));
    engine.registerHandler(new ChoiceHandler({
        ...engine.theme,
        selectedBackgroundColor: engine.theme.hoverColor,
        selectedBorderColor: engine.theme.accentColor
    }));

    // Register macros
    if (Object.keys(macros).length > 0) {
        Object.entries(macros).forEach(([n, s]) =>
            engine.registerTemplate(n, s as any)
        );
    }

    engine.loadScenes(validatedScenes);

    await engine.init(canvas);

    const startScene = manifest.startScene ?? 'intro';
    await engine.startScreen.show(startScene);
}

await bootstrap();