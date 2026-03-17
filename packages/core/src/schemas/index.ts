import { z } from 'zod';

import type { BaseCommand } from '../types';

export { parseAudiosheetDescriptor, parseSpritesheetDescriptor } from './descriptorSchemas';


export const BaseCommandSchema = z.object({
    type: z.string(),
}).catchall(z.unknown());

/* Dialogue */

export const DialogueCommandSchema = z.object({
    instant: z.boolean().optional(),
    portraitSide: z.enum(['left', 'right']).optional(),
    speaker: z.string(),
    text: z.string(),
    type: z.literal('dialogue'),
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
    commands: z.array(z.lazy(() => CommandSchema)).optional(),
    label: z.string(),
});

export const ChoiceCommandSchema = z.object({
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
    flip: z.boolean().optional(),
    id: z.string(),
    pose: z.string().optional(),
    scaleX: z.number().optional(),
    scaleY: z.number().optional(),
    transition: z.enum(['instant', 'fade']).optional(),
    type: z.literal('sprite'),
    wait: z.boolean().optional(),
    x: z.number().optional(),
    y: z.number().optional(),
});

/* Flash */

export const FlashCommandSchema = z.object({
    color: z.number().optional(),
    duration: z.number().optional(),
    type: z.literal('flash'),
    wait: z.boolean().optional(),
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

