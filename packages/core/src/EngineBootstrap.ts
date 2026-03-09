import type { AssetResolver, EngineDeps } from './Engine';
import type {EngineConfig} from './EngineConfig';
import type { EvidenceItem } from './managers/EvidenceManager';
import type { CharacterDefinition, GameManifest, Script } from './types';

import { Engine } from './Engine';
import { BuiltInHandlers, ChoiceHandler, DialogueHandler } from './handlers';
import { AssetManager } from './managers/AssetManager';
import { AudioManager } from './managers/AudioManager';
import { DisplayManager } from './managers/DisplayManager';
import { EventBus } from './managers/EventBus';
import { EvidenceManager } from './managers/EvidenceManager';
import { HistoryManager } from './managers/HistoryManager';
import { InputManager } from './managers/InputManager';
import { NotificationManager } from './managers/NotificationManager';
import { OverlayManager } from './managers/OverlayManager';
import { SaveManager } from './managers/SaveManager';
import { SceneManager } from './managers/SceneManager';
import { SpritesheetManager } from './managers/SpritesheetManager';
import { StartScreenManager } from './managers/StartScreenManager';
import { StateManager } from './managers/StateManager';

export interface EngineBootstrapOptions {
    assetResolver?: AssetResolver;
    canvas: HTMLCanvasElement;
    characters?: Record<string, CharacterDefinition>;
    config?: EngineConfig;
    defaultBlipUrl?: string;
    items?: Record<string, Omit<EvidenceItem, 'id'>>;
    macros?: Record<string, Script>;
    manifest?: GameManifest;
    preloadAssets?: boolean;
    scenes?: Record<string, Script>;
}

export async function bootstrapEngine(options: EngineBootstrapOptions): Promise<Engine> {
    const {
        assetResolver,
        canvas,
        characters = {},
        config = {},
        defaultBlipUrl = '/assets/sfx/blip.wav',
        items = {},
        macros = {},
        manifest = {},
        preloadAssets = false,
        scenes = {},
    } = options;

    const engine = new Engine(config, createDefaultEngineDeps);
    if (assetResolver) {
        engine.assetResolver = assetResolver;
    }

    engine.setManifest({ ...manifest, characters });

    if (preloadAssets) {
        await engine.assets.preloadCharacterAssets(characters);
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
        for (const [name, script] of Object.entries(macros)) engine.scenes.registerTemplate(name, script);
    }
    
    if (Object.keys(scenes).length > 0) {
        engine.scenes.loadScenes(scenes);
    }

    if (engine.config.debug) {
        (globalThis as unknown as { zerith: Engine }).zerith = engine;
    }

    await engine.init(canvas);
    engine.registerDefaultPanels();

    return engine;
}

function createDefaultEngineDeps(engine: Engine, config: EngineConfig): EngineDeps {
    const events = new EventBus();
    // Ensure managers that subscribe in constructor see the final bus instance.
    engine.events = events;

    const audio = new AudioManager(config.audio);
    const display = new DisplayManager(engine.app, config.display);
    const input = new InputManager(engine, config.input);
    const scenes = new SceneManager(engine);
    const saves = new SaveManager(engine);
    const notifications = new NotificationManager(engine, config.notifications);
    const startScreen = new StartScreenManager(engine, config.startScreen);
    const history = new HistoryManager();
    const items = new EvidenceManager();
    const state = new StateManager();
    const spritesheets = new SpritesheetManager();
    const assets = new AssetManager(spritesheets);
    const overlay = new OverlayManager(engine, config.overlay);

    return {
        assets,
        audio,
        display,
        events,
        history,
        input,
        items,
        notifications,
        overlay,
        saves,
        scenes,
        spritesheets,
        startScreen,
        state,
    };
}