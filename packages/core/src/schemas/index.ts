import { z } from 'zod';

import type { BaseCommand } from '../types';

import {
    type ContentSchemaVersion,
    ContentSchemaVersionSchema,
    CURRENT_CONTENT_SCHEMA_VERSION,
    LEGACY_CONTENT_SCHEMA_VERSION,
} from './contentVersionSchemas';
import { LocalizationConfigSchema } from './localizationSchemas';

export * from './contentMigration';
export * from './contentVersionSchemas';
export { parseAudiosheetDescriptor, parseSheetDescriptor, parseSpritesheetDescriptor } from './descriptorSchemas';
export * from './engineConfigSchemas';
export * from './localizationSchemas';

const NonEmptyStringSchema = z.string().trim().min(1);

export const BaseCommandSchema = z.object({
    type: z.string(),
}).catchall(z.unknown());

export const GameManifestSchema = z.looseObject({
    $schema: z.string().optional(),
    author: z.string().optional(),
    characters: z.union([z.string(), z.record(z.string(), z.unknown())]).optional(),
    description: z.string().optional(),
    items: z.union([z.string(), z.record(z.string(), z.unknown())]).optional(),
    license: z.string().optional(),
    localization: z.lazy(() => LocalizationConfigSchema).optional(),
    macros: z.union([z.string(), z.record(z.string(), z.array(z.lazy(() => CommandSchema)))]).optional(),
    scenes: z.record(z.string(), z.union([
        z.string(),
        z.array(z.lazy(() => CommandSchema)),
        z.lazy(() => SceneFileEnvelopeSchema),
    ])).optional(),
    schemaVersion: ContentSchemaVersionSchema.optional(),
    startScene: z.string().optional(),
    title: z.string().optional(),
    variables: z.record(z.string(), z.unknown()).optional(),
    version: z.string().optional(),
});

/* Dialogue */

export const DialogueCommandSchema = z.object({
    autoAdvanceProfile: NonEmptyStringSchema.optional(),
    backlogVisibility: z.enum(['hide', 'show']).optional(),
    expressionRef: NonEmptyStringSchema.optional(),
    instant: z.boolean().optional(),
    lineId: NonEmptyStringSchema.optional(),
    portraitSide: z.enum(['left', 'right']).optional(),
    speaker: z.string(),
    tags: z.array(NonEmptyStringSchema).optional(),
    text: z.string(),
    type: z.literal('dialogue'),
    voice: z.union([
        NonEmptyStringSchema,
        z.looseObject({
            assetUrl: NonEmptyStringSchema,
            cue: NonEmptyStringSchema.optional(),
            volume: z.number().optional(),
        }),
    ]).optional(),
});

/* Background */

export const BackgroundCommandSchema = z.object({
    assetUrl: z.string(),
    type: z.literal('background'),
});

/* BGM */

export const BgmCommandSchema = z.object({
    action: z.enum(['play', 'stop', 'pause', 'resume']),
    assetUrl: z.string().optional(),
    loop: z.boolean().optional(),
    type: z.literal('bgm'),
    volume: z.number().optional(),
});

/* SFX */

export const SfxCommandSchema = z.object({
    assetUrl: z.string(),
    type: z.literal('sfx'),
    volume: z.number().optional(),
});

/* Transition */

export const TransitionCommandSchema = z.object({
    action: z.enum(['fade_out', 'fade_in']),
    duration: z.number().optional(),
    type: z.literal('transition'),
});

/* Scene Change */

export const SceneChangeCommandSchema = z.object({
    assetUrl: z.string(),
    duration: z.number().optional(),
    type: z.literal('scene_change'),
});

/* Shake */

export const ShakeCommandSchema = z.object({
    duration: z.number().optional(),
    intensity: z.number().optional(),
    type: z.literal('shake'),
    wait: z.boolean().optional(),
});

/* Wait */

export const WaitCommandSchema = z.object({
    duration: z.number(),
    type: z.literal('wait'),
});

/* Set */

export const SetCommandSchema = z.object({
    key: z.string(),
    op: z.enum(['set', 'add', 'sub', 'toggle']).optional(),
    type: z.literal('set'),
    value: z.unknown().optional(),
});

/* If */

const ComparisonOpSchema = z.enum(['eq', 'neq', 'gt', 'gte', 'lt', 'lte']);

const ConditionSchema = z.object({
    key: z.string(),
    op: ComparisonOpSchema.optional(),
    source: z.string().optional(),
    value: z.unknown().optional(),
});

export const IfCommandSchema = z.object({
    all: z.array(ConditionSchema).optional(),
    any: z.array(ConditionSchema).optional(),
    key: z.string().optional(),
    onFalse: z.array(z.lazy(() => CommandSchema)).optional(),
    onTrue: z.array(z.lazy(() => CommandSchema)).optional(),
    op: ComparisonOpSchema.optional(),
    source: z.string().optional(),
    type: z.literal('if'),
    value: z.unknown().optional(),
});

/* While */

export const WhileCommandSchema = z.object({
    all: z.array(ConditionSchema).optional(),
    any: z.array(ConditionSchema).optional(),
    body: z.array(z.lazy(() => CommandSchema)).optional(),
    key: z.string().optional(),
    maxIterations: z.number().int().positive().optional(),
    op: ComparisonOpSchema.optional(),
    source: z.string().optional(),
    type: z.literal('while'),
    value: z.unknown().optional(),
});

/* For */

export const ForCommandSchema = z.object({
    body: z.array(z.lazy(() => CommandSchema)).optional(),
    from: z.number().optional(),
    iterator: z.string().optional(),
    step: z.number().optional(),
    to: z.number().optional(),
    type: z.literal('for'),
});

/* Choice */

export const ChoiceOptionSchema = z.object({
    all: z.array(ConditionSchema).optional(),
    analyticsLabel: NonEmptyStringSchema.optional(),
    any: z.array(ConditionSchema).optional(),
    commands: z.array(z.lazy(() => CommandSchema)).optional(),
    id: NonEmptyStringSchema.optional(),
    label: z.string(),
    labelId: NonEmptyStringSchema.optional(),
    onceOnly: z.boolean().optional(),
    replayable: z.boolean().optional(),
});

export const ChoiceCommandSchema = z.object({
    analyticsLabel: NonEmptyStringSchema.optional(),
    id: NonEmptyStringSchema.optional(),
    options: z.array(ChoiceOptionSchema),
    type: z.literal('choice'),
});

/* Jump */

export const JumpCommandSchema = z.object({
    to: z.string(),
    type: z.literal('jump'),
});

/* Goto */

export const GotoCommandSchema = z.object({
    label: z.string(),
    type: z.literal('goto'),
});

/* Label */

export const LabelCommandSchema = z.object({
    name: z.string(),
    type: z.literal('label'),
});

/* Block */

export const BlockCommandSchema = z.object({
    commands: z.array(z.lazy(() => CommandSchema)),
    type: z.literal('block'),
});

/* Call */

export const CallCommandSchema = z.object({
    name: z.string(),
    type: z.literal('call'),
});

/* Sprite */

export const SpriteCommandSchema = z.object({
    action: z.enum(['show', 'hide', 'move', 'pose', 'animate']),
    anchorX: z.number().optional(),
    anchorY: z.number().optional(),
    animation: z.string().optional(),
    assetUrl: z.string().optional(),
    duration: z.number().optional(),
    fit: z.enum(['contain', 'cover', 'stretch']).optional(),
    flip: z.boolean().optional(),
    heightRatio: z.number().optional(),
    id: z.string(),
    pose: z.string().optional(),
    scaleX: z.number().optional(),
    scaleY: z.number().optional(),
    transition: z.enum(['instant', 'fade']).optional(),
    type: z.literal('sprite'),
    wait: z.boolean().optional(),
    widthRatio: z.number().optional(),
    x: z.number().optional(),
    xRatio: z.number().optional(),
    y: z.number().optional(),
    yRatio: z.number().optional(),
});

/* Flash */

export const FlashCommandSchema = z.object({
    color: z.number().optional(),
    duration: z.number().optional(),
    type: z.literal('flash'),
    wait: z.boolean().optional(),
});

/* Weather */

export const WeatherCommandSchema = z.object({
    action: z.enum(['start', 'stop', 'clear']).optional(),
    alpha: z.number().optional(),
    angle: z.number().optional(),
    color: z.number().optional(),
    density: z.number().optional(),
    fadeIn: z.number().optional(),
    fadeOut: z.number().optional(),
    id: z.string().optional(),
    layer: z.string().trim().min(1).refine((layer) => layer !== 'ui', {
        message: 'Weather layer cannot target ui.',
    }).optional(),
    preset: z.enum([
        'ash',
        'ashfall',
        'blizzard',
        'drizzle',
        'embers',
        'heavy_rain',
        'rain',
        'snow',
        'snowfall',
        'storm',
    ]).optional(),
    size: z.number().optional(),
    speed: z.number().optional(),
    type: z.literal('weather'),
    wind: z.number().optional(),
});

/* Item */

export const ItemCommandSchema = z.object({
    action: z.enum(['add', 'remove', 'update']),
    changes: z.record(z.string(), z.unknown()).optional(),
    id: z.string(),
    type: z.literal('item'),
});

/* Built-in schema set */

const BuiltInCommandSchemas = [
    DialogueCommandSchema,
    ChoiceCommandSchema,
    BackgroundCommandSchema,
    BgmCommandSchema,
    SfxCommandSchema,
    TransitionCommandSchema,
    SceneChangeCommandSchema,
    ShakeCommandSchema,
    WaitCommandSchema,
    SetCommandSchema,
    IfCommandSchema,
    WhileCommandSchema,
    ForCommandSchema,
    JumpCommandSchema,
    GotoCommandSchema,
    LabelCommandSchema,
    BlockCommandSchema,
    CallCommandSchema,
    SpriteCommandSchema,
    FlashCommandSchema,
    WeatherCommandSchema,
    ItemCommandSchema,
] as const;

export const CommandSchema: z.ZodType<BaseCommand> = z.discriminatedUnion('type', BuiltInCommandSchemas);

const BuiltInCommandSchemaRegistry: Record<string, z.ZodType> = {
    background: BackgroundCommandSchema,
    bgm: BgmCommandSchema,
    block: BlockCommandSchema,
    call: CallCommandSchema,
    choice: ChoiceCommandSchema,
    dialogue: DialogueCommandSchema,
    flash: FlashCommandSchema,
    for: ForCommandSchema,
    goto: GotoCommandSchema,
    if: IfCommandSchema,
    item: ItemCommandSchema,
    jump: JumpCommandSchema,
    label: LabelCommandSchema,
    scene_change: SceneChangeCommandSchema,
    set: SetCommandSchema,
    sfx: SfxCommandSchema,
    shake: ShakeCommandSchema,
    sprite: SpriteCommandSchema,
    transition: TransitionCommandSchema,
    wait: WaitCommandSchema,
    weather: WeatherCommandSchema,
    while: WhileCommandSchema,
};

type DiscriminatedOption = z.ZodObject<{ type: z.ZodLiteral<string>; } & z.ZodRawShape>;

class SchemaRegistrySingleton {
    public readonly schemas: Record<string, z.ZodType>;

    constructor(initialSchemas: Record<string, z.ZodType>) {
        this.schemas = { ...initialSchemas };
    }

    /**
     * Returns a schema by command type when registered.
     */
    public get(type: string): undefined | z.ZodType {
        return this.schemas[type];
    }

    public getCommandSchema(): z.ZodType {
        const options = Object.values(this.schemas) as DiscriminatedOption[];
        const knownTypes = new Set(Object.keys(this.schemas));

        const FallbackSchema = BaseCommandSchema.refine((cmd) => !knownTypes.has(cmd.type));

        if (options.length === 0) {
            return FallbackSchema;
        }

        if (options.length === 1) {
            return z.union([options[0], FallbackSchema]);
        }

        const [first, ...rest] = options as [DiscriminatedOption, ...DiscriminatedOption[]];
        const KnownCommandSchema = z.discriminatedUnion('type', [first, ...rest]);
        return z.union([KnownCommandSchema, FallbackSchema]);
    }

    public getRegistry(): Record<string, z.ZodType> {
        return this.schemas;
    }

    /**
     * Returns all registered command type keys.
     */
    public getTypes(): string[] {
        return Object.keys(this.schemas);
    }

    /**
     * Registers or replaces a schema for a command type.
     */
    public register(type: string, schema: z.ZodType): void {
        this.schemas[type] = schema;
    }
}

/**
 * Mutable command schema registry used by validation and editor introspection.
 */
export const SchemaRegistry = new SchemaRegistrySingleton(BuiltInCommandSchemaRegistry);

/**
 * Script-level schema built from the currently registered command schemas.
 */
export const ScriptSchema = z.array(z.lazy(() => SchemaRegistry.getCommandSchema()));

export const SceneFileEnvelopeSchema = z.looseObject({
    $schema: z.string().optional(),
    commands: z.array(z.unknown()),
    graph: z.record(z.string(), z.unknown()).optional(),
    id: NonEmptyStringSchema.optional(),
    localeNamespace: NonEmptyStringSchema.optional(),
    schemaVersion: ContentSchemaVersionSchema.optional(),
});

export interface ParsedSceneFile {
    commands: BaseCommand[];
    metadata: Omit<SceneFileEnvelope, 'commands'>;
    schemaVersion: ContentSchemaVersion;
}

type SceneFileEnvelope = z.infer<typeof SceneFileEnvelopeSchema>;

export function isSceneFileEnvelope(value: unknown): value is SceneFileEnvelope {
    return SceneFileEnvelopeSchema.safeParse(value).success;
}

export function parseSceneFile(value: unknown, options: { sceneName?: string } = {}): ParsedSceneFile {
    if (Array.isArray(value)) {
        return {
            commands: validateScript(value),
            metadata: {},
            schemaVersion: LEGACY_CONTENT_SCHEMA_VERSION,
        };
    }

    const parsed = SceneFileEnvelopeSchema.safeParse(value);
    if (!parsed.success) {
        const label = options.sceneName ? ` "${options.sceneName}"` : '';
        throw new TypeError(`Invalid scene${label}: expected a command array or a scene object with a commands array.`);
    }

    const { commands, ...metadata } = parsed.data;

    return {
        commands: validateScript(commands),
        metadata,
        schemaVersion: metadata.schemaVersion ?? CURRENT_CONTENT_SCHEMA_VERSION,
    };
}

/**
 * Validates an entire script array. Returns parsed commands or throws.
 */
export function validateScript(script: unknown[]): BaseCommand[] {
    const commandSchema = SchemaRegistry.getCommandSchema();
    return script.map((cmd, index) => {
        const result = commandSchema.safeParse(cmd);
        if (!result.success) {
            console.warn(`[Schema] Invalid command at index ${index}:`, result.error.issues);
            return cmd as BaseCommand;
        }
        return result.data as BaseCommand;
    });
}

