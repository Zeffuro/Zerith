import type {AssetResolver} from './Engine';
import {Engine} from './Engine';
import { BuiltInHandlers } from './handlers/builtins';
import { ChoiceHandler } from './handlers/ChoiceHandler';
import { DialogueHandler } from './handlers/DialogueHandler';
import type {EngineConfig} from './EngineConfig';
import type {GameManifest} from './types';
import { preloadCharacterAssets } from './utils/preloadCharacterAssets';

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

    const engine = new Engine({
        ...config,
        onSceneNavigation: config.onSceneNavigation ?? (isEditor ? () => 'skip' : undefined),
    });
    if (assetResolver) {
        engine.assetResolver = assetResolver;
    }

    engine.manifest = {...manifest, characters};

    if (preloadAssets) {
        await preloadCharacterAssets(engine, characters);
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
    engine.registerDefaultPanels();

    return engine;
}