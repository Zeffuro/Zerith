import type { AccessibilityConfig } from '../EngineConfig';
import type { TextConfig } from '../EngineConfig';
import type {
    IAnimationManager,
    IAssetManager,
    IAudioManager,
    IDisplayManager,
    IEventBus,
    IEvidenceManager,
    IFlowManager,
    IHistoryManager,
    ISceneManager,
    ISpritesheetManager,
    IStateManager,
} from '../interfaces/managers';
import type { CharacterDefinition, GameManifest } from '../types';
import type { Logger } from '../utils/Logger';
import type { Theme } from '../utils/Theme';

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
    WeatherHandler,
    WhileHandler,
} from '../handlers';

export interface RegisterHandlersOptions {
    accessibility?: AccessibilityConfig;
    animations: IAnimationManager;
    assets: IAssetManager;
    audio: IAudioManager;
    characters: Record<string, CharacterDefinition>;
    defaultBlipUrl?: string;
    display: IDisplayManager;
    events: IEventBus;
    evidence: IEvidenceManager;
    flow: IFlowManager;
    history: IHistoryManager;
    logger: Logger;
    manifestData: GameManifest;
    sceneManager: ISceneManager;
    spritesheets: ISpritesheetManager;
    state: IStateManager;
    text?: TextConfig;
    theme: Theme;
}

export interface RegisterHandlersResult {
    dialogueHandler: DialogueHandler;
}

export function registerHandlers(options: RegisterHandlersOptions): RegisterHandlersResult {
    const {
        accessibility,
        animations,
        assets,
        audio,
        characters,
        defaultBlipUrl,
        display,
        events,
        evidence,
        flow,
        history,
        logger,
        manifestData,
        sceneManager,
        spritesheets,
        state,
        text,
        theme,
    } = options;

    const dialogueHandler = new DialogueHandler(
        assets,
        animations,
        audio,
        display,
        events,
        flow,
        history,
        logger,
        state,
        {
            announceDialogue: accessibility?.announceDialogue,
            backgroundAlpha: theme.boxAlpha,
            backgroundColor: theme.boxColor,
            borderColor: theme.borderColor,
            borderWidth: theme.borderWidth,
            captions: accessibility?.captions,
            characters,
            defaultBlipUrl,
            markupMode: text?.markupMode,
            messageStyle: {
                fontFamily: theme.fontFamily,
                fontSize: theme.fontSize,
            },
            nameStyle: {
                fontFamily: theme.fontFamily,
                fontSize: Math.max(theme.fontSize + 4, theme.fontSize * 1.2),
                fontWeight: 'bold',
            },
            reducedMotion: accessibility?.reducedMotion,
            selfVoicing: accessibility?.selfVoicing,
            typewriterSpeed: Math.round(30 * (accessibility?.typewriterSpeedMultiplier ?? 1)),
        },
    );

    flow.registerHandlers([
        new BackgroundHandler(assets, display, state, events),
        new TransitionHandler(animations, display),
        new JumpHandler(sceneManager),
        new SceneChangeHandler(flow),
        new BlockHandler(flow),
        new CallHandler(logger, sceneManager, flow),
        new BgmHandler(assets, audio, logger, state, events),
        new SfxHandler(assets, audio, logger),
        new SetHandler(state),
        new IfHandler(flow, evidence, state),
        new WhileHandler(flow, logger, evidence, state),
        new ForHandler(flow),
        new ShakeHandler(animations, display),
        new WaitHandler(),
        new LabelHandler(),
        new GotoHandler(logger, sceneManager),
        new SpriteHandler(assets, display, events, logger, spritesheets, state, () => manifestData),
        new FlashHandler(animations, display),
        new WeatherHandler(display, state, events),
        new ItemHandler(evidence),
        dialogueHandler,
        new ChoiceHandler(display, events, flow, {
            ...theme,
            selectedBackgroundColor: theme.hoverColor,
            selectedBorderColor: theme.accentColor,
        }),
    ]);

    return { dialogueHandler };
}

