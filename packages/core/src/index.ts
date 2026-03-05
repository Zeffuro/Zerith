/* Handlers */
import { BackgroundHandler } from './handlers/BackgroundHandler';
import { TransitionHandler } from './handlers/TransitionHandler';
import { JumpHandler } from './handlers/JumpHandler';
import { SceneChangeHandler } from './handlers/SceneChangeHandler';
import { BlockHandler } from './handlers/BlockHandler';
import { CallHandler } from './handlers/CallHandler';
import { BgmHandler } from './handlers/BgmHandler';
import { SfxHandler } from './handlers/SfxHandler';
import { SetHandler } from './handlers/SetHandler';
import { IfHandler } from './handlers/IfHandler';
import { ShakeHandler } from './handlers/ShakeHandler';
import { WaitHandler } from './handlers/WaitHandler';
import { LabelHandler } from './handlers/LabelHandler';
import { GotoHandler } from './handlers/GotoHandler';
import { SpriteHandler } from './handlers/SpriteHandler';

/* Root */
export * from './Engine';
export * from './EngineConfig';
export * from './types';
export * from './commands';
export * from './schemas';

/* Handlers */
export * from './handlers/BackgroundHandler';
export * from './handlers/DialogueHandler';
export * from './handlers/ChoiceHandler';
export * from './handlers/TransitionHandler';
export * from './handlers/JumpHandler';
export * from './handlers/SceneChangeHandler';
export * from './handlers/BlockHandler';
export * from './handlers/CallHandler';
export * from './handlers/BgmHandler';
export * from './handlers/SfxHandler';
export * from './handlers/SetHandler';
export * from './handlers/IfHandler';
export * from './handlers/ShakeHandler';
export * from './handlers/WaitHandler';
export * from './handlers/LabelHandler';
export * from './handlers/GotoHandler';
export * from './handlers/SpriteHandler';

/* Managers */
export * from './managers/SaveManager';
export * from './managers/AudioManager';
export * from './managers/InputManager';
export * from './managers/SceneManager';
export * from './managers/NotificationManager';
export * from './managers/DisplayManager';
export * from './managers/EventBus';
export * from './managers/StartScreenManager';
export * from './managers/HistoryManager';
export * from './managers/PauseMenuManager';

/* Utils */
export * from './utils/TextParser';
export * from './utils/Theme';

/**
 * Handlers that require no constructor config.
 * DialogueHandler and ChoiceHandler need config objects,
 * so they must be instantiated manually.
 */
export const BuiltInHandlers = [
    BackgroundHandler,
    TransitionHandler,
    JumpHandler,
    SceneChangeHandler,
    BlockHandler,
    CallHandler,
    BgmHandler,
    SfxHandler,
    SetHandler,
    IfHandler,
    ShakeHandler,
    WaitHandler,
    LabelHandler,
    GotoHandler,
    SpriteHandler,
];