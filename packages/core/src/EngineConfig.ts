import type { AudioConfig } from './managers/AudioManager';
import type { DisplayConfig } from './managers/DisplayManager';
import type { InputConfig } from './managers/InputManager';
import type { NotificationConfig } from './managers/NotificationManager';
import type { StartScreenConfig } from './managers/StartScreenManager';
import type { OverlayConfig } from './managers/OverlayManager.ts';
import type { Theme } from './utils/Theme';

export interface EngineConfig {
    display?: Partial<DisplayConfig>;
    audio?: AudioConfig;
    input?: InputConfig;
    notifications?: NotificationConfig;
    startScreen?: StartScreenConfig;
    overlay?: OverlayConfig;
    theme?: Partial<Theme>;
}