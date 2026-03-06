import { Engine } from './Engine';
import { BuiltInHandlers, DialogueHandler, ChoiceHandler } from './index';

export interface EngineBootstrapOptions {
    canvas: HTMLCanvasElement;
    manifest: any;
    theme?: any;
    assetResolver?: (url: string) => string;
}

export async function bootstrapEngine(options: EngineBootstrapOptions) {
    const engine = new Engine({
        display: { width: 1280, height: 720, scaleMode: 'fit' },
        theme: options.theme || {},
    });

    if (options.assetResolver) {
        engine.assetResolver = options.assetResolver;
        engine.isEditor = true;
    }

    engine.manifest = options.manifest;
    engine.registerHandlers(BuiltInHandlers);

    // Setup specialized handlers
    engine.registerHandler(new DialogueHandler({
        ...engine.theme,
        characters: options.manifest.characters,
        defaultBlipUrl: '/assets/sfx/blip.wav'
    }));

    engine.registerHandler(new ChoiceHandler({
        ...engine.theme,
        selectedBackgroundColor: engine.theme.hoverColor,
        selectedBorderColor: engine.theme.accentColor
    }));

    await engine.init(options.canvas);
    return engine;
}