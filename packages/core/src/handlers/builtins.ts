import { BackgroundHandler } from './BackgroundHandler';
import { BgmHandler } from './BgmHandler';
import { BlockHandler } from './BlockHandler';
import { CallHandler } from './CallHandler';
import { FlashHandler } from './FlashHandler';
import { ForHandler } from './ForHandler';
import { GotoHandler } from './GotoHandler';
import { IfHandler } from './IfHandler';
import { ItemHandler } from './ItemHandler';
import { JumpHandler } from './JumpHandler';
import { LabelHandler } from './LabelHandler';
import { SceneChangeHandler } from './SceneChangeHandler';
import { SetHandler } from './SetHandler';
import { SfxHandler } from './SfxHandler';
import { ShakeHandler } from './ShakeHandler';
import { SpriteHandler } from './SpriteHandler';
import { TransitionHandler } from './TransitionHandler';
import { WaitHandler } from './WaitHandler';
import { WhileHandler } from './WhileHandler';

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
    WhileHandler,
    ForHandler,
    ShakeHandler,
    WaitHandler,
    LabelHandler,
    GotoHandler,
    SpriteHandler,
    FlashHandler,
    ItemHandler,
];

