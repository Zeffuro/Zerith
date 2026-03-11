import type { EngineDeps } from '../Engine';
import type { EngineConfig } from '../EngineConfig';
import type { CommandHandlerRegistry } from '../interfaces/ICommandHandler';
import type { IOverlayConfigProvider, IStorageProvider, IThemeProvider } from '../interfaces/providers';
import type { FlowManagerDeps } from '../managers/FlowManager';
import type { IInputContext } from '../managers/InputManager';
import type { NotificationDeps } from '../managers/NotificationManager';
import type { SaveContext } from '../managers/SaveManager';
import type { SceneManagerDeps } from '../managers/SceneManager';
import type { StartScreenDeps } from '../managers/StartScreenManager';

import { AnimationManager } from '../managers/AnimationManager';
import { AssetManager } from '../managers/AssetManager';
import { AudioManager } from '../managers/AudioManager';
import { DisplayManager } from '../managers/DisplayManager';
import { EventBus } from '../managers/EventBus';
import { EvidenceManager } from '../managers/EvidenceManager';
import { FlowManager } from '../managers/FlowManager';
import { HistoryManager } from '../managers/HistoryManager';
import { InputManager } from '../managers/InputManager';
import { NotificationManager } from '../managers/NotificationManager';
import { OverlayManager } from '../managers/OverlayManager';
import { SaveManager } from '../managers/SaveManager';
import { SceneManager } from '../managers/SceneManager';
import { SpritesheetManager } from '../managers/SpritesheetManager';
import { StartScreenManager } from '../managers/StartScreenManager';
import { StateManager } from '../managers/StateManager';
import { Logger } from '../utils/Logger';
import { DefaultTheme } from '../utils/Theme';

export interface CreateManagersOptions {
    config: EngineConfig;
}

export interface CreateManagersResult {
    deps: EngineDeps;
    evidence: EvidenceManager;
    flow: FlowManager;
    history: HistoryManager;
    logger: Logger;
    overlay: OverlayManager;
    saveManager: SaveManager;
    sceneManager: SceneManager;
    state: StateManager;
    theme: ReturnType<IThemeProvider['getTheme']>;
}

export function createManagers(options: CreateManagersOptions): CreateManagersResult {
    const { config } = options;

    const events = new EventBus();
    const animations = new AnimationManager();
    const audio = new AudioManager(config.audio);
    const display = new DisplayManager(config.display);
    const history = new HistoryManager();
    const evidence = new EvidenceManager();
    const state = new StateManager(events);
    const spritesheets = new SpritesheetManager();
    const assets = new AssetManager(audio, spritesheets);
    const logger = new Logger('[Engine]');

    const sceneManagerDeps: SceneManagerDeps = {
        assets,
        events,
        logger,
    };
    const sceneManager = new SceneManager(sceneManagerDeps);

    const handlers: CommandHandlerRegistry = new Map();

    const flowDeps: FlowManagerDeps = {
        events,
        handlers,
        logger,
        onSceneNavigation: config.onSceneNavigation,
        scenes: sceneManager,
    };
    const flow = new FlowManager(flowDeps);

    const theme = createTheme(config);
    const themeProvider: IThemeProvider = {
        getTheme: () => theme,
    };
    const overlayConfigProvider = createOverlayConfigProvider(config);

    const overlay = new OverlayManager({
        display,
        events,
        overlayConfigProvider,
        overlayLayer: display.getLayer('overlay'),
        themeProvider,
    });

    const inputContext: IInputContext = {
        isOverlayOpen: () => overlay.isOpen,
        isStarted: () => flow.isStarted,
    };
    const input = new InputManager(events, inputContext, config.input);

    const storage = resolveStorageProvider(config.storage);

    const saveContext: SaveContext = {
        getCurrentSceneName: () => sceneManager.currentSceneName,
        getLastSavePoint: () => flow.lastSavePoint,
        getStateSnapshot: () => state.state,
        getSystemSnapshot: () => state.system,
        logInfo: (message) => logger.info(message),
        logWarn: (message) => logger.warn(message),
        serializeItems: () => evidence.serialize(),
    };
    const saveManager = new SaveManager(saveContext, storage);

    events.on('state:persistent_changed', (data) => {
        saveManager.saveGlobalState(data);
    });

    const notificationDeps: NotificationDeps = {
        display,
        overlayLayer: display.getLayer('overlay'),
        themeProvider,
    };
    const notifications = new NotificationManager(notificationDeps, config.notifications);

    const startScreenDeps: StartScreenDeps = {
        display,
        events,
        overlayLayer: display.getLayer('overlay'),
        scenes: sceneManager,
    };
    const startScreen = new StartScreenManager(startScreenDeps, config.startScreen);

    const deps: EngineDeps = {
        animations,
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

    return {
        deps,
        evidence,
        flow,
        history,
        logger,
        overlay,
        saveManager,
        sceneManager,
        state,
        theme,
    };
}

function createOverlayConfigProvider(config: EngineConfig): IOverlayConfigProvider {
    return {
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
}

function createTheme(config: EngineConfig): ReturnType<IThemeProvider['getTheme']> {
    return { ...DefaultTheme, ...config.theme };
}

function resolveStorageProvider(storageOverride: IStorageProvider | undefined): IStorageProvider {
    if (storageOverride) {
        return storageOverride;
    }

    const browserStorage = globalThis.localStorage;
    if (browserStorage !== undefined) {
        return {
            getItem: (key: string) => browserStorage.getItem(key) ?? undefined,
            removeItem: (key: string) => {
                browserStorage.removeItem(key);
            },
            setItem: (key: string, value: string) => {
                browserStorage.setItem(key, value);
            },
        };
    }

    const fallbackStorage = new Map<string, string>();
    return {
        getItem: (key: string) => fallbackStorage.get(key),
        removeItem: (key: string) => {
            fallbackStorage.delete(key);
        },
        setItem: (key: string, value: string) => {
            fallbackStorage.set(key, value);
        },
    };
}

