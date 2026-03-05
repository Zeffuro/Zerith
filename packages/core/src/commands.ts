import type { BackgroundCommand } from './handlers/BackgroundHandler';
import type { DialogueCommand } from './handlers/DialogueHandler';
import type { ChoiceCommand } from './handlers/ChoiceHandler';
import type { TransitionCommand } from './handlers/TransitionHandler';
import type { JumpCommand } from './handlers/JumpHandler';
import type { SceneChangeCommand } from './handlers/SceneChangeHandler';
import type { BlockCommand } from './handlers/BlockHandler';
import type { CallCommand } from './handlers/CallHandler';
import type { BgmCommand } from './handlers/BgmHandler';
import type { SfxCommand } from './handlers/SfxHandler';
import type { SetCommand } from './handlers/SetHandler';
import type { IfCommand } from './handlers/IfHandler';
import type { ShakeCommand } from './handlers/ShakeHandler';
import type { WaitCommand } from './handlers/WaitHandler';
import type { LabelCommand } from './handlers/LabelHandler';
import type { GotoCommand } from './handlers/GotoHandler';
import type { SpriteCommand } from './handlers/SpriteHandler';
import type { FlashCommand } from './handlers/FlashHandler';
import type { ItemCommand } from "./handlers/ItemHandler.ts";

export type Command =
    | BackgroundCommand
    | DialogueCommand
    | ChoiceCommand
    | TransitionCommand
    | JumpCommand
    | SceneChangeCommand
    | BlockCommand
    | CallCommand
    | BgmCommand
    | SfxCommand
    | SetCommand
    | IfCommand
    | ShakeCommand
    | WaitCommand
    | LabelCommand
    | GotoCommand
    | SpriteCommand
    | FlashCommand
    | ItemCommand;

export type TypedScript = Command[];