import { AudioManager } from './managers/AudioManager';
import { DisplayManager } from './managers/DisplayManager';
import { EventBus } from './managers/EventBus';
import { InputManager } from './managers/InputManager';
import { NotificationManager } from './managers/NotificationManager';
import { StartScreenManager } from './managers/StartScreenManager';
import { SceneManager } from './managers/SceneManager';
import { SaveManager } from './managers/SaveManager';
import { OverlayManager } from './managers/OverlayManager';
import { HistoryManager } from './managers/HistoryManager';
import { EvidenceManager } from './managers/EvidenceManager';
import { SpritesheetManager } from './managers/SpritesheetManager';
import { AssetManager } from './managers/AssetManager';
import type { AssetResolver, EngineDeps } from './Engine';
import { Engine } from './Engine';
import { BuiltInHandlers } from './handlers/builtins';
import { ChoiceHandler } from './handlers/ChoiceHandler';
import { DialogueHandler } from './handlers/DialogueHandler';
import type {EngineConfig} from './EngineConfig';
import type {GameManifest} from './types';

export interface EngineBootstrapOptions {
    canvas: HTMLCanvasElement;
    config?: EngineConfig;
    manifest?: GameManifest;
    assetResolver?: AssetResolver;
    characters?: Record<string, any>;
    defaultBlipUrl?: string;
    items?: Record<string, any>;
    macros?: Record<string, any[]>;
    scenes?: Record<string, any[]>;
    preloadAssets?: boolean;
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
    const spritesheets = new SpritesheetManager();
    const assets = new AssetManager(spritesheets);
    const overlay = new OverlayManager(engine, config.overlay);

    return {
        events,
        audio,
        display,
        input,
        scenes,
        saves,
        notifications,
        startScreen,
        overlay,
        history,
        items,
        spritesheets,
        assets,
    };
}

export async function bootstrapEngine(options: EngineBootstrapOptions): Promise<Engine> {
    const {
        canvas,
        config = {},
        manifest = {},
        assetResolver,
        characters = {},
        defaultBlipUrl = '/assets/sfx/blip.wav',
        items = {},
        macros = {},
        scenes = {},
        preloadAssets = false,
    } = options;

    const engine = new Engine(config, createDefaultEngineDeps);
    if (assetResolver) {
        engine.assetResolver = assetResolver;
    }

    engine.manifest = {...manifest, characters};

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
        Object.entries(macros).forEach(([name, script]) =>
            engine.scenes.registerTemplate(name, script as any)
        );
    }

    if (Object.keys(scenes).length > 0) {
        engine.scenes.loadScenes(scenes);
    }

    await engine.init(canvas);
    engine.registerDefaultPanels();

    return engine;
}