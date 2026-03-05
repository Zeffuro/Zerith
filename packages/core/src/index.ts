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
import { FlashHandler } from './handlers/FlashHandler';
import { ItemHandler } from './handlers/ItemHandler';

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
export * from './handlers/FlashHandler';
export * from './handlers/ItemHandler';

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
export * from './managers/OverlayManager';
export * from './managers/ItemManager';
export * from './managers/EvidenceManager';
export * from './managers/SpritesheetManager';
export * from './ui/PanelFocusManager';

/* UI */
export * from './ui/UIComponents';
export * from './ui/HistoryPanel';
export * from './ui/SaveLoadPanel';
export * from './ui/ItemBrowserPanel';
export * from './ui/SettingsPanel';

/* Utils */
export * from './utils/TextParser';
export * from './utils/Theme';
export * from './utils/AssetPreloader';
export * from './utils/ManifestResolver';
export * from './utils/ChromaKey';

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
    FlashHandler,
    ItemHandler,
];