import type { AssetResolver, EngineDeps } from './Engine';
import type { EngineConfig } from './EngineConfig';
import type { CommandHandlerRegistry } from './interfaces/ICommandHandler';
import type { IOverlayConfigProvider, IThemeProvider } from './interfaces/providers';
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
import { FlowManager } from './managers/FlowManager';
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
    const logger = new Logger('[Engine]');
    const sceneManager = new SceneManager({
        assets,
        events,
        logger,
    });
    const handlers: CommandHandlerRegistry = new Map();
    const flow = new FlowManager({
        events,
        handlers,
        logger,
        onSceneNavigation: config.onSceneNavigation,
        scenes: sceneManager,
    });
    const theme = { ...DefaultTheme, ...config.theme };
    const themeProvider: IThemeProvider = {
        getTheme: () => theme,
    };
    const overlayConfigProvider: IOverlayConfigProvider = {
        getConfig: () => ({
            backgroundAlpha: 0.85,
            backgroundColor: 0x00_00_00,
            buttonAlpha: 0.9,
            buttonColor: 0x22_22_44,
            buttonHeight: 50,
            buttonHoverColor: 0x33_33_99,
            buttonSpacing: 12,
            buttonWidth: 300,
            fontFamily: 'Courier New',
            fontSize: 22,
            textColor: 0xFF_FF_FF,
            uiScale: 1,
            ...config.overlay,
        }),
    };

    const overlay = new OverlayManager({
        display,
        events,
        getCanvasElement: () => display.canvas,
        overlayConfigProvider,
        overlayLayer: display.getLayer('overlay'),
        themeProvider,
    });

    const input = new InputManager(events, {
        isOverlayOpen: () => overlay.isOpen,
        isStarted: () => flow.isStarted,
    }, config.input);

    const saveManager = new SaveManager({
        getCurrentSceneName: () => sceneManager.currentSceneName,
        getLastSavePoint: () => flow.lastSavePoint,
        getStateSnapshot: () => state.state,
        getSystemSnapshot: () => state.system,
        logInfo: (message) => logger.info(message),
        logWarn: (message) => logger.warn(message),
        serializeItems: () => evidence.serialize(),
    });

    const notifications = new NotificationManager({
        display,
        overlayLayer: display.getLayer('overlay'),
        themeProvider,
    }, config.notifications);

    const startScreen = new StartScreenManager({
        display,
        events,
        overlayLayer: display.getLayer('overlay'),
        scenes: sceneManager,
    }, config.startScreen);

    const deps: EngineDeps = {
        assets,
        audio,
        display,
        events,
        flow,
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
    const manifestData = { ...manifest, characters };

    const dialogueHandler = new DialogueHandler(
        assets,
        audio,
        display,
        events,
        flow,
        history,
        logger,
        state,
        (command) => flow.runCommand(command),
        {
            ...theme,
            characters,
            defaultBlipUrl,
        },
    );

    flow.registerHandlers([
        new BackgroundHandler(assets, display, state, events),
        new TransitionHandler(display),
        new JumpHandler(sceneManager),
        new SceneChangeHandler(flow),
        new BlockHandler(flow),
        new CallHandler(logger, sceneManager, flow),
        new BgmHandler(assets, audio, logger, state, events),
        new SfxHandler(assets, audio, logger),
        new SetHandler(state),
        new IfHandler(flow, evidence, state),
        new WhileHandler(flow, logger, evidence, state),
        new ForHandler(flow, state),
        new ShakeHandler(display),
        new WaitHandler(),
        new LabelHandler(),
        new GotoHandler(logger, sceneManager),
        new SpriteHandler(assets, display, events, logger, spritesheets, state, () => manifestData),
        new FlashHandler(display),
        new ItemHandler(evidence),
        dialogueHandler,
        new ChoiceHandler(display, events, flow, {
            ...theme,
            selectedBackgroundColor: theme.hoverColor,
            selectedBorderColor: theme.accentColor,
        }),
    ]);

    const engine = new Engine(config, deps);
    engine.theme = themeProvider.getTheme();
    engine.logger = logger;

    if (assetResolver) {
        engine.assetResolver = assetResolver;
    }

    engine.setManifest(manifestData);

    if (preloadAssets) {
        await engine.assets.preloadCharacterAssets(characters);
    }

    if (Object.keys(items).length > 0) {
        engine.items.loadDefinitions(items);
    }

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
