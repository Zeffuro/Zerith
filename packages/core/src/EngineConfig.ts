import type { IStorageProvider } from './interfaces/providers';
import type { AudioConfig } from './managers/AudioManager';
import type { DisplayConfig } from './managers/DisplayManager';
import type { InputConfig } from './managers/InputManager';
import type { NotificationConfig } from './managers/NotificationManager';
import type { OverlayConfig } from './managers/OverlayManager';
import type { StartScreenConfig } from './managers/StartScreenManager';
import type { SceneNavigationCommandType } from './types';
import type { Theme } from './utils/Theme';

import { z } from 'zod';

export type { SceneNavigationCommandType } from './types';

const DisplayScaleModeSchema = z.enum(['fill', 'fit', 'fixed', 'stretch']);

const AudioConfigSchema = z.object({
    bgmVolume: z.number().finite().optional(),
    masterVolume: z.number().finite().optional(),
    muted: z.boolean().optional(),
    sfxVolume: z.number().finite().optional(),
    voiceVolume: z.number().finite().optional(),
}).strict();

const DisplayConfigSchema = z.object({
    backgroundColor: z.number().int().nonnegative().optional(),
    height: z.number().int().positive().optional(),
    scaleMode: DisplayScaleModeSchema.optional(),
    width: z.number().int().positive().optional(),
}).strict();

const ThemeSchema = z.object({
    accentColor: z.number().int().nonnegative().optional(),
    borderColor: z.number().int().nonnegative().optional(),
    borderWidth: z.number().finite().optional(),
    boxAlpha: z.number().min(0).max(1).optional(),
    boxColor: z.number().int().nonnegative().optional(),
    fontFamily: z.string().optional(),
    fontSize: z.number().finite().optional(),
    hoverColor: z.number().int().nonnegative().optional(),
}).strict();

const StartScreenConfigSchema = z.object({
    backgroundAlpha: z.number().min(0).max(1).optional(),
    backgroundColor: z.number().int().nonnegative().optional(),
    fontFamily: z.string().optional(),
    fontSize: z.number().finite().optional(),
    fontWeight: z.string().optional(),
    pulseMax: z.number().finite().optional(),
    pulseMin: z.number().finite().optional(),
    pulseSpeed: z.number().finite().optional(),
    text: z.string().optional(),
    textColor: z.number().int().nonnegative().optional(),
}).strict();

export const EngineConfigSchema = z.object({
    $schema: z.literal('zerith/engine-config').optional(),
    audio: AudioConfigSchema.optional(),
    debug: z.boolean().optional(),
    display: DisplayConfigSchema.optional(),
    input: z.record(z.string(), z.unknown()).optional(),
    notifications: z.record(z.string(), z.unknown()).optional(),
    overlay: z.record(z.string(), z.unknown()).optional(),
    startScreen: StartScreenConfigSchema.optional(),
    theme: ThemeSchema.optional(),
}).passthrough();

export type EngineConfigFile = z.infer<typeof EngineConfigSchema>;


export interface EngineConfig {
    audio?: AudioConfig;
    debug?: boolean;
    display?: Partial<DisplayConfig>;
    input?: InputConfig;
    notifications?: NotificationConfig;
    onSceneNavigation?: (sceneName: string, commandType: SceneNavigationCommandType) => SceneNavigationAction;
    overlay?: OverlayConfig;
    startScreen?: StartScreenConfig;
    storage?: IStorageProvider;
    theme?: Partial<Theme>;
}

export type SceneNavigationAction = 'execute' | 'skip';