import { z } from 'zod';

import { ContentSchemaVersionSchema } from './contentVersionSchemas';

export const DisplayScaleModeSchema = z.enum(['fill', 'fit', 'fixed', 'stretch']);

export const DisplayLayerSchema = z.strictObject({
    id: z.string().trim().min(1),
    order: z.float64().optional(),
});

export const AudioConfigSchema = z.strictObject({
    bgmVolume: z.float64().optional(),
    defaultBlipUrl: z.string().trim().min(1).nullable().optional(),
    masterVolume: z.float64().optional(),
    muted: z.boolean().optional(),
    sfxVolume: z.float64().optional(),
    voiceVolume: z.float64().optional(),
});

const InputKeyListSchema = z.array(z.string().trim().min(1));

export const InputConfigSchema = z.strictObject({
    advanceKeys: InputKeyListSchema.optional(),
    backKeys: InputKeyListSchema.optional(),
    confirmKeys: InputKeyListSchema.optional(),
    gamepadAdvanceButton: z.int().nonnegative().optional(),
    gamepadBackButton: z.int().nonnegative().optional(),
    gamepadConfirmButton: z.int().nonnegative().optional(),
    gamepadDownButton: z.int().nonnegative().optional(),
    gamepadLeftButton: z.int().nonnegative().optional(),
    gamepadMenuButton: z.int().nonnegative().optional(),
    gamepadRightButton: z.int().nonnegative().optional(),
    gamepadUpButton: z.int().nonnegative().optional(),
    loadKey: z.string().trim().min(1).optional(),
    menuKey: z.string().trim().min(1).optional(),
    navigateDownKeys: InputKeyListSchema.optional(),
    navigateLeftKeys: InputKeyListSchema.optional(),
    navigateRightKeys: InputKeyListSchema.optional(),
    navigateUpKeys: InputKeyListSchema.optional(),
    saveKey: z.string().trim().min(1).optional(),
});

export const AccessibilityConfigSchema = z.strictObject({
    captions: z.boolean().optional(),
    highContrast: z.boolean().optional(),
    reducedMotion: z.boolean().optional(),
    selfVoicing: z.boolean().optional(),
    textScale: z.float64().min(0.75).max(2).optional(),
    typewriterSpeedMultiplier: z.float64().min(0).max(4).optional(),
});

export const DisplayConfigSchema = z.strictObject({
    backgroundColor: z.int().nonnegative().optional(),
    height: z.int().positive().optional(),
    layers: z.array(DisplayLayerSchema).optional(),
    scaleMode: DisplayScaleModeSchema.optional(),
    width: z.int().positive().optional(),
});

export const ThemeSchema = z.strictObject({
    accentColor: z.int().nonnegative().optional(),
    borderColor: z.int().nonnegative().optional(),
    borderWidth: z.float64().optional(),
    boxAlpha: z.float64().min(0).max(1).optional(),
    boxColor: z.int().nonnegative().optional(),
    fontFamily: z.string().optional(),
    fontSize: z.float64().optional(),
    hoverColor: z.int().nonnegative().optional(),
});

export const TextMarkupModeSchema = z.enum(['html', 'plain', 'zerith']);

export const TextConfigSchema = z.strictObject({
    markupMode: TextMarkupModeSchema.optional(),
});

export const StartScreenConfigSchema = z.strictObject({
    backgroundAlpha: z.float64().min(0).max(1).optional(),
    backgroundColor: z.int().nonnegative().optional(),
    fontFamily: z.string().optional(),
    fontSize: z.float64().optional(),
    fontWeight: z.string().optional(),
    pulseMax: z.float64().optional(),
    pulseMin: z.float64().optional(),
    pulseSpeed: z.float64().optional(),
    text: z.string().optional(),
    textColor: z.int().nonnegative().optional(),
});

export const PreviewConfigSchema = z.strictObject({
    fontAssetUrl: z.string().optional(),
    useDisplayConfig: z.boolean().optional(),
});

const PlayerColorSchema = z.union([z.int().min(0).max(0xFF_FF_FF), z.string().regex(/^#[\da-f]{6}$/iu)]);

export const PlayerConfigSchema = z.strictObject({
    accentColor: z.union([z.int().min(0).max(0xFF_FF_FF), z.string().regex(/^#[\da-f]{6}$/iu)]).optional(),
    actionLabels: z.partialRecord(z.enum(['continue', 'history', 'load', 'new-game', 'resume', 'save', 'settings', 'title']), z.string().trim().min(1).max(80)).optional(),
    background: z.string().trim().min(1).max(2048).optional(),
    backgroundOpacity: z.float64().min(0).max(1).optional(),
    buttonColor: PlayerColorSchema.optional(),
    buttonHeight: z.int().min(44).max(80).optional(),
    cornerStyle: z.enum(['rounded', 'square', 'pill']).optional(),
    enabled: z.boolean().optional(),
    menuFont: z.enum(['system', 'serif', 'monospace']).optional(),
    menuFontSize: z.int().min(14).max(24).optional(),
    menuWidth: z.int().min(220).max(600).optional(),
    panelColor: PlayerColorSchema.optional(),
    panelOpacity: z.float64().min(0).max(1).optional(),
    pauseActions: z.array(z.enum(['history', 'load', 'resume', 'save', 'settings', 'title'])).max(6).optional(),
    rememberSettings: z.boolean().optional(),
    saveSlots: z.int().min(1).max(24).optional(),
    subtitle: z.string().trim().min(1).max(240).optional(),
    textColor: PlayerColorSchema.optional(),
    title: z.string().trim().min(1).max(120).optional(),
    titleActions: z.array(z.enum(['continue', 'load', 'new-game', 'settings'])).max(4).optional(),
    titleAlignment: z.enum(['left', 'center', 'right']).optional(),
});

export const EngineConfigSchema = z.looseObject({
    $schema: z.literal('zerith/engine-config').optional(),
    accessibility: AccessibilityConfigSchema.optional(),
    audio: AudioConfigSchema.optional(),
    debug: z.boolean().optional(),
    display: DisplayConfigSchema.optional(),
    input: InputConfigSchema.optional(),
    notifications: z.record(z.string(), z.unknown()).optional(),
    overlay: z.record(z.string(), z.unknown()).optional(),
    player: PlayerConfigSchema.optional(),
    preview: PreviewConfigSchema.optional(),
    schemaVersion: ContentSchemaVersionSchema.optional(),
    startScreen: StartScreenConfigSchema.optional(),
    text: TextConfigSchema.optional(),
    theme: ThemeSchema.optional(),
});

