import type {AssetResolver} from './Engine';
import {Engine} from './Engine';
import {BuiltInHandlers, ChoiceHandler, DialogueHandler} from './index';
import type {EngineConfig} from './EngineConfig';
import type {GameManifest} from './types';

export interface EngineBootstrapOptions {
    canvas: HTMLCanvasElement;
    config?: EngineConfig;
    manifest?: GameManifest;
    assetResolver?: AssetResolver;
    isEditor?: boolean;
    characters?: Record<string, any>;
    defaultBlipUrl?: string;
    items?: Record<string, any>;
    macros?: Record<string, any[]>;
    scenes?: Record<string, any[]>;
    preloadAssets?: boolean;
}

export async function bootstrapEngine(options: EngineBootstrapOptions): Promise<Engine> {
    const {
        canvas,
        config = {},
        manifest = {},
        assetResolver,
        isEditor = false,
        characters = {},
        defaultBlipUrl = '/assets/sfx/blip.wav',
        items = {},
        macros = {},
        scenes = {},
        preloadAssets = false,
    } = options;

    const engine = new Engine(config);

    engine.isEditor = isEditor;
    if (assetResolver) {
        engine.assetResolver = assetResolver;
    }

    engine.manifest = {...manifest, characters};

    if (preloadAssets && Object.keys(characters).length > 0) {
        const { Assets } = await import('pixi.js');
        const { sound } = await import('@pixi/sound');

        const promises: Promise<any>[] = [];
        for (const [, char] of Object.entries(characters) as [string, any][]) {
            if (char.portraitUrl) {
                promises.push(Assets.load(char.portraitUrl).catch(() => {}));
            }
            if (char.blipUrl && !sound.exists(char.blipUrl)) {
                promises.push(new Promise<void>(resolve => {
                    sound.add(char.blipUrl, {
                        url: char.blipUrl,
                        preload: true,
                        loaded: () => resolve()
                    });
                }));
            }
            if (char.spritesheet?.atlasUrl) {
                promises.push(engine.spritesheets.load(char.spritesheet).catch((err) => {
                    console.warn(`Failed to preload spritesheet: ${char.spritesheet.atlasUrl}`, err);
                }));
            }
        }
        await Promise.all(promises);
    }

    if (Object.keys(items).length > 0) {
        engine.items.loadDefinitions(items);
    }

    engine.registerHandlers(BuiltInHandlers);
    engine.registerHandler(new DialogueHandler({
        ...engine.theme,
        characters,
        defaultBlipUrl,
    }));
    engine.registerHandler(new ChoiceHandler({
        ...engine.theme,
        selectedBackgroundColor: engine.theme.hoverColor,
        selectedBorderColor: engine.theme.accentColor,
    }));

    if (Object.keys(macros).length > 0) {
        Object.entries(macros).forEach(([name, script]) =>
            engine.registerTemplate(name, script as any)
        );
    }

    if (Object.keys(scenes).length > 0) {
        engine.loadScenes(scenes);
    }

    await engine.init(canvas);

    return engine;
}