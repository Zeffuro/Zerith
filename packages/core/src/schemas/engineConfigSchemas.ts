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

export const EngineConfigSchema = z.looseObject({
    $schema: z.literal('zerith/engine-config').optional(),
    accessibility: AccessibilityConfigSchema.optional(),
    audio: AudioConfigSchema.optional(),
    debug: z.boolean().optional(),
    display: DisplayConfigSchema.optional(),
    input: InputConfigSchema.optional(),
    notifications: z.record(z.string(), z.unknown()).optional(),
    overlay: z.record(z.string(), z.unknown()).optional(),
    preview: PreviewConfigSchema.optional(),
    schemaVersion: ContentSchemaVersionSchema.optional(),
    startScreen: StartScreenConfigSchema.optional(),
    text: TextConfigSchema.optional(),
    theme: ThemeSchema.optional(),
});

