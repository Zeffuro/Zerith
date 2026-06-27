import { z } from 'zod';

import type { IStorageProvider } from './interfaces/providers';
import type { AudioConfig } from './managers/AudioManager';
import type { DisplayConfig } from './managers/DisplayManager';
import type { InputConfig } from './managers/InputManager';
import type { NotificationConfig } from './managers/NotificationManager';
import type { OverlayConfig } from './managers/OverlayManager';
import type { StartScreenConfig } from './managers/StartScreenManager';
import type { DialogueAnnouncementHandler } from './types';
import type { SceneNavigationCommandType } from './types';
import type { TextMarkupMode } from './utils/TextParser';
import type { Theme } from './utils/Theme';

import { EngineConfigSchema } from './schemas';

export {EngineConfigSchema} from './schemas';

export interface AccessibilityConfig {
    announceDialogue?: DialogueAnnouncementHandler;
    captions?: boolean;
    highContrast?: boolean;
    reducedMotion?: boolean;
    selfVoicing?: boolean;
    textScale?: number;
    typewriterSpeedMultiplier?: number;
}

export interface EngineConfig {
    accessibility?: AccessibilityConfig;
    audio?: AudioConfig;
    debug?: boolean;
    display?: Partial<DisplayConfig>;
    input?: InputConfig;
    notifications?: NotificationConfig;
    onSceneNavigation?: (sceneName: string, commandType: SceneNavigationCommandType) => SceneNavigationAction;
    overlay?: OverlayConfig;
    preview?: {
        fontAssetUrl?: string;
        useDisplayConfig?: boolean;
    };
    startScreen?: StartScreenConfig;
    storage?: IStorageProvider;
    text?: TextConfig;
    theme?: Partial<Theme>;
}

export type EngineConfigFile = z.infer<typeof EngineConfigSchema>;

export type SceneNavigationAction = 'execute' | 'skip';

export interface TextConfig {
    markupMode?: TextMarkupMode;
}

export function parseEngineConfig(config: unknown) {
    return EngineConfigSchema.safeParse(config);
}
export type { SceneNavigationCommandType } from './types';
