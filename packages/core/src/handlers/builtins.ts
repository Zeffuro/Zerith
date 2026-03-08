import { BackgroundHandler } from './BackgroundHandler';
import { TransitionHandler } from './TransitionHandler';
import { JumpHandler } from './JumpHandler';
import { SceneChangeHandler } from './SceneChangeHandler';
import { BlockHandler } from './BlockHandler';
import { CallHandler } from './CallHandler';
import { BgmHandler } from './BgmHandler';
import { SfxHandler } from './SfxHandler';
import { SetHandler } from './SetHandler';
import { IfHandler } from './IfHandler';
import { WhileHandler } from './WhileHandler';
import { ForHandler } from './ForHandler';
import { ShakeHandler } from './ShakeHandler';
import { WaitHandler } from './WaitHandler';
import { LabelHandler } from './LabelHandler';
import { GotoHandler } from './GotoHandler';
import { SpriteHandler } from './SpriteHandler';
import { FlashHandler } from './FlashHandler';
import { ItemHandler } from './ItemHandler';

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

