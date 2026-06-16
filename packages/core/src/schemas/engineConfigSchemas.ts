import { z } from 'zod';

export const DisplayScaleModeSchema = z.enum(['fill', 'fit', 'fixed', 'stretch']);

export const DisplayLayerSchema = z.strictObject({
    id: z.string().trim().min(1),
    order: z.float64().optional(),
});

export const AudioConfigSchema = z.strictObject({
    bgmVolume: z.float64().optional(),
    masterVolume: z.float64().optional(),
    muted: z.boolean().optional(),
    sfxVolume: z.float64().optional(),
    voiceVolume: z.float64().optional(),
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
    audio: AudioConfigSchema.optional(),
    debug: z.boolean().optional(),
    display: DisplayConfigSchema.optional(),
    input: z.record(z.string(), z.unknown()).optional(),
    notifications: z.record(z.string(), z.unknown()).optional(),
    overlay: z.record(z.string(), z.unknown()).optional(),
    preview: PreviewConfigSchema.optional(),
    startScreen: StartScreenConfigSchema.optional(),
    theme: ThemeSchema.optional(),
});

