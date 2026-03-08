import type { AudioConfig } from './managers/AudioManager';
import type { DisplayConfig } from './managers/DisplayManager';
import type { InputConfig } from './managers/InputManager';
import type { NotificationConfig } from './managers/NotificationManager';
import type { OverlayConfig } from './managers/OverlayManager.ts';
import type { StartScreenConfig } from './managers/StartScreenManager';
import type { SceneNavigationCommandType } from './types';
import type { Theme } from './utils/Theme';

export type { SceneNavigationCommandType } from './types';
export interface EngineConfig {
    audio?: AudioConfig;
    display?: Partial<DisplayConfig>;
    input?: InputConfig;
    notifications?: NotificationConfig;
    onSceneNavigation?: (sceneName: string, commandType: SceneNavigationCommandType) => SceneNavigationAction;
    overlay?: OverlayConfig;
    startScreen?: StartScreenConfig;
    theme?: Partial<Theme>;
}

export type SceneNavigationAction = 'execute' | 'skip';