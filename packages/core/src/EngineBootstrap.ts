import type { AssetResolver, EngineDeps } from './Engine';
import type { EngineConfig } from './EngineConfig';
import type { EvidenceItem } from './managers/EvidenceManager';
import type { CharacterDefinition, GameManifest, Script } from './types';

import { Engine } from './Engine';
import {
    BackgroundHandler,
    BgmHandler,
    BlockHandler,
    CallHandler,
    ChoiceHandler,
    DialogueHandler,
    FlashHandler,
    ForHandler,
    GotoHandler,
    IfHandler,
    ItemHandler,
    JumpHandler,
    LabelHandler,
    SceneChangeHandler,
    SetHandler,
    SfxHandler,
    ShakeHandler,
    SpriteHandler,
    TransitionHandler,
    WaitHandler,
    WhileHandler,
} from './handlers';
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
import { HistoryPanel } from './ui/HistoryPanel';
import { ItemBrowserPanel } from './ui/ItemBrowserPanel';
import { SaveLoadPanel } from './ui/SaveLoadPanel';
import { SettingsPanel } from './ui/SettingsPanel';
import { Logger } from './utils/Logger';
import { DefaultTheme } from './utils/Theme';

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

    const events = new EventBus();
    const audio = new AudioManager(config.audio);
    const display = new DisplayManager(config.display);
    const history = new HistoryManager();
    const evidence = new EvidenceManager();
    const state = new StateManager();
    const spritesheets = new SpritesheetManager();
    const assets = new AssetManager(spritesheets);

    let engineReference: Engine | undefined;

    const overlay = new OverlayManager({
        display,
        events,
        getCanvasElement: () => display.canvas,
        getTheme: () => engineReference?.theme ?? DefaultTheme,
        overlayLayer: display.getLayer('overlay'),
    }, config.overlay);

    const input = new InputManager(events, {
        get isOverlayOpen() {
            return overlay.isOpen;
        },
        get isStarted() {
            return engineReference?.isStarted ?? false;
        },
    }, config.input);

    const sceneManager = new SceneManager({
        assets,
        events,
        logger: new Logger('[Engine]'),
    });

    const saveManager = new SaveManager({
        getCurrentSceneName: () => engineReference?.currentSceneName ?? sceneManager.currentSceneName,
        getLastSavePoint: () => engineReference?.lastSavePoint ?? 0,
        getStateSnapshot: () => engineReference?.state ?? state.state,
        getSystemSnapshot: () => state.system,
        logInfo: (message) => engineReference?.logger.info(message),
        logWarn: (message) => engineReference?.logger.warn(message),
        serializeItems: () => evidence.serialize(),
    });

    const notifications = new NotificationManager({
        display,
        getTheme: () => engineReference?.theme ?? DefaultTheme,
        overlayLayer: display.getLayer('overlay'),
    }, config.notifications);

    const startScreen = new StartScreenManager({
        display,
        events,
        onStart: () => engineReference?.start(),
        overlayLayer: display.getLayer('overlay'),
        scenes: sceneManager,
    }, config.startScreen);

    const deps: EngineDeps = {
        assets,
        audio,
        display,
        events,
        history,
        input,
        items: evidence,
        notifications,
        overlay,
        saves: saveManager,
        scenes: sceneManager,
        spritesheets,
        startScreen,
        state,
    };

    const engine = new Engine(config, deps);
    engineReference = engine;

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

    const dialogueHandler = new DialogueHandler(
        assets,
        audio,
        display,
        events,
        engine.flow,
        history,
        engine.logger,
        state,
        (command) => engine.flow.runCommand(command),
        {
            ...engine.theme,
            characters,
            defaultBlipUrl,
        },
    );

    engine.registerHandlers([
        new BackgroundHandler(assets, display, state, events),
        new TransitionHandler(display),
        new JumpHandler(sceneManager),
        new SceneChangeHandler(engine.flow),
        new BlockHandler(engine.flow),
        new CallHandler(engine.logger, sceneManager, engine.flow),
        new BgmHandler(assets, audio, engine.logger, state, events),
        new SfxHandler(assets, audio, engine.logger),
        new SetHandler(state),
        new IfHandler(engine.flow, evidence, state),
        new WhileHandler(engine.flow, engine.logger, evidence, state),
        new ForHandler(engine.flow, state),
        new ShakeHandler(display),
        new WaitHandler(),
        new LabelHandler(),
        new GotoHandler(engine.logger, sceneManager),
        new SpriteHandler(assets, display, events, engine.logger, spritesheets, state, () => engine.manifest),
        new FlashHandler(display),
        new ItemHandler(evidence),
        dialogueHandler,
        new ChoiceHandler(display, events, engine.flow, {
            ...engine.theme,
            selectedBackgroundColor: engine.theme.hoverColor,
            selectedBorderColor: engine.theme.accentColor,
        }),
    ]);

    engine.registerDefaultPanels([
        new HistoryPanel(history),
        new ItemBrowserPanel(evidence, (url) => assets.load(url)),
        new SettingsPanel(audio, dialogueHandler),
        new SaveLoadPanel('save', saveManager, notifications, (saveState) => engine.applySaveState(saveState), () => overlay.close()),
        new SaveLoadPanel('load', saveManager, notifications, (saveState) => engine.applySaveState(saveState), () => overlay.close()),
    ]);

    if (Object.keys(macros).length > 0) {
        for (const [name, script] of Object.entries(macros)) {
            sceneManager.registerTemplate(name, script);
        }
    }

    if (Object.keys(scenes).length > 0) {
        sceneManager.loadScenes(scenes);
    }

    if (engine.config.debug) {
        (globalThis as unknown as { zerith: Engine }).zerith = engine;
    }

    await engine.init(canvas);
    bindDefaultInputEvents(engine);

    return engine;
}

function bindDefaultInputEvents(engine: Engine) {
    const events = engine.events;
    const flow = engine.flow;
    const notifications = engine.notifications;
    const saves = engine.saves;

    events.on('input:skip', () => {
        flow.requestSkip();
    });

    events.on('input:next', () => {
        void flow.playNext();
    });

    events.on('input:save', (slot: number) => {
        saves.save(slot);
        notifications.show('Game Saved!');
    });

    events.on('input:load', (slot: number) => {
        void saves.load(slot).then(async (saveData) => {
            if (!saveData) {
                notifications.show('Save not found');
                return;
            }

            await engine.applySaveState(saveData);
            notifications.show('Game Loaded!');
        });
    });
}
