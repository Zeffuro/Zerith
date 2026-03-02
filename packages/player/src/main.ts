import { Engine, BuiltInHandlers, DialogueHandler, ChoiceHandler } from 'core';

const FlashPlugin = {
    type: 'custom_flash',
    autoNext: true,
    execute: async (command: any, _engine: Engine) => {
        console.log(`SCREEN FLASHES ${command.color.toUpperCase()}`);
    }
};

async function bootstrap() {
    const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
    const engine = new Engine();

    engine.logger.info("Fetching game manifest...");

    const manifestRes = await fetch('/game.json');
    if (!manifestRes.ok) throw new Error("Could not find game.json!");
    const manifest = await manifestRes.json();

    const defaults = BuiltInHandlers.filter(handler => handler !== DialogueHandler);
    engine.registerHandlers(defaults);

    const sharedTheme = {
        backgroundColor: 0x000055,
        backgroundAlpha: 0.9,
        borderColor: 0xaaaaff,
        borderWidth: 4,
        textStyle: { fontFamily: 'Courier New' }
    };

    engine.registerHandler(new DialogueHandler({
        ...sharedTheme,
        messageStyle: sharedTheme.textStyle,
        nameStyle: sharedTheme.textStyle,
        defaultBlipUrl: '/assets/sfx/blip.wav',
        characters: manifest.characters
    }));
    engine.registerHandler(new ChoiceHandler(sharedTheme));

    engine.registerHandler(FlashPlugin);

    if (manifest.macros) {
        for (const [name, script] of Object.entries(manifest.macros)) {
            engine.registerTemplate(name, script as any);
        }
    }

    await engine.init(canvas);

    const introRes = await fetch('/scripts/intro.json');
    const courtRes = await fetch('/scripts/courtroom.json');

    engine.loadScenes({
        'intro': await introRes.json(),
        'courtroom': await courtRes.json()
    });

    window.addEventListener('keydown', (e) => {
        if (e.key === 's' || e.key === 'S') {
            engine.saves.save(1);
            alert("Game Saved to Slot 1!");
        }
        if (e.key === 'l' || e.key === 'L') {
            engine.saves.load(1);
        }
    });

    engine.logger.info(`Starting game: ${manifest.title}`);
    await engine.jumpToScene(manifest.startScene);
}

await bootstrap();