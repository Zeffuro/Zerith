/* Handlers */
import { BackgroundHandler } from './handlers/BackgroundHandler';
import { DialogueHandler } from './handlers/DialogueHandler';
import { ChoiceHandler } from "./handlers/ChoiceHandler.ts";
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

/* Root */
export * from './Engine';
export * from './types';

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

/* Managers */
export * from './managers/SaveManager'

/* Utils */
export * from './utils/TextParser'

export const BuiltInHandlers = [
    BackgroundHandler,
    DialogueHandler,
    ChoiceHandler,
    TransitionHandler,
    JumpHandler,
    SceneChangeHandler,
    BlockHandler,
    CallHandler,
    BgmHandler,
    SfxHandler,
    SetHandler,
    IfHandler,
    ShakeHandler
];