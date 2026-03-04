import { Engine, BuiltInHandlers, DialogueHandler, ChoiceHandler } from 'core';

async function bootstrap() {
    const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;

    const [manifest, intro, court] = await Promise.all([
        fetch('/game.json').then(r => r.json()),
        fetch('/scripts/intro.json').then(r => r.json()),
        fetch('/scripts/courtroom.json').then(r => r.json())
    ]);

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

    engine.manifest = manifest;

    engine.registerHandlers(BuiltInHandlers);
    engine.registerHandler(new DialogueHandler({
        ...engine.theme,
        characters: manifest.characters,
        defaultBlipUrl: '/assets/sfx/blip.wav'
    }));
    engine.registerHandler(new ChoiceHandler({
        ...engine.theme,
        selectedBackgroundColor: engine.theme.hoverColor,
        selectedBorderColor: engine.theme.accentColor
    }));

    if (manifest.macros) {
        Object.entries(manifest.macros).forEach(([n, s]) =>
            engine.registerTemplate(n, s as any)
        );
    }
    engine.loadScenes({ intro, courtroom: court });

    await engine.init(canvas);

    const startScene = manifest.startScene ?? 'intro';
    await engine.startScreen.show(startScene);
}

await bootstrap();