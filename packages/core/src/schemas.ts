import { z } from 'zod';

/* Base */

const BaseCommandSchema = z.object({
    type: z.string(),
}).catchall(z.unknown());

/* Dialogue */

export const DialogueCommandSchema = z.object({
    type: z.literal('dialogue'),
    speaker: z.string(),
    text: z.string(),
    portraitSide: z.enum(['left', 'right']).optional(),
    instant: z.boolean().optional(),
});

/* Background */

export const BackgroundCommandSchema = z.object({
    type: z.literal('background'),
    assetUrl: z.string(),
});

/* BGM */

export const BgmCommandSchema = z.object({
    type: z.literal('bgm'),
    action: z.enum(['play', 'stop', 'pause', 'resume']),
    assetUrl: z.string().optional(),
    volume: z.number().optional(),
    loop: z.boolean().optional(),
});

/* SFX */

export const SfxCommandSchema = z.object({
    type: z.literal('sfx'),
    assetUrl: z.string(),
    volume: z.number().optional(),
});

/* Transition */

export const TransitionCommandSchema = z.object({
    type: z.literal('transition'),
    action: z.enum(['fade_out', 'fade_in']),
    duration: z.number().optional(),
});

/* Scene Change */

export const SceneChangeCommandSchema = z.object({
    type: z.literal('scene_change'),
    assetUrl: z.string(),
    duration: z.number().optional(),
});

/* Shake */

export const ShakeCommandSchema = z.object({
    type: z.literal('shake'),
    duration: z.number().optional(),
    intensity: z.number().optional(),
    wait: z.boolean().optional(),
});

/* Wait */

export const WaitCommandSchema = z.object({
    type: z.literal('wait'),
    duration: z.number(),
});

/* Set */

export const SetCommandSchema = z.object({
    type: z.literal('set'),
    key: z.string(),
    value: z.any().optional(),
    op: z.enum(['set', 'add', 'sub', 'toggle']).optional(),
});

/* If */

const ComparisonOpSchema = z.enum(['eq', 'neq', 'gt', 'gte', 'lt', 'lte']);

const ConditionSchema = z.object({
    key: z.string(),
    op: ComparisonOpSchema.optional(),
    value: z.any().optional(),
    source: z.string().optional(),
});

export const IfCommandSchema = z.object({
    type: z.literal('if'),
    key: z.string().optional(),
    op: ComparisonOpSchema.optional(),
    value: z.any().optional(),
    source: z.string().optional(),
    all: z.array(ConditionSchema).optional(),
    any: z.array(ConditionSchema).optional(),
    then: z.array(BaseCommandSchema).optional(),
    else: z.array(BaseCommandSchema).optional(),
});

/* While */

export const WhileCommandSchema = z.object({
    type: z.literal('while'),
    key: z.string().optional(),
    op: ComparisonOpSchema.optional(),
    value: z.any().optional(),
    source: z.string().optional(),
    all: z.array(ConditionSchema).optional(),
    any: z.array(ConditionSchema).optional(),
    body: z.array(BaseCommandSchema).optional(),
    maxIterations: z.number().int().positive().optional(),
});

/* For */

export const ForCommandSchema = z.object({
    type: z.literal('for'),
    iterator: z.string().optional(),
    from: z.number().optional(),
    to: z.number().optional(),
    step: z.number().optional(),
    body: z.array(BaseCommandSchema).optional(),
});

/* Choice */

export const ChoiceOptionSchema = z.object({
    label: z.string(),
    commands: z.array(BaseCommandSchema).optional(),
});

export const ChoiceCommandSchema = z.object({
    type: z.literal('choice'),
    options: z.array(ChoiceOptionSchema),
});

/* Jump */

export const JumpCommandSchema = z.object({
    type: z.literal('jump'),
    to: z.string(),
});

/* Goto */

export const GotoCommandSchema = z.object({
    type: z.literal('goto'),
    label: z.string(),
});

/* Label */

export const LabelCommandSchema = z.object({
    type: z.literal('label'),
    name: z.string(),
});

/* Block */

export const BlockCommandSchema = z.object({
    type: z.literal('block'),
    commands: z.array(BaseCommandSchema),
});

/* Call */

export const CallCommandSchema = z.object({
    type: z.literal('call'),
    name: z.string(),
});

/* Sprite */

export const SpriteCommandSchema = z.object({
    type: z.literal('sprite'),
    id: z.string(),
    action: z.enum(['show', 'hide', 'move', 'pose', 'animate']),
    assetUrl: z.string().optional(),
    pose: z.string().optional(),
    animation: z.string().optional(),
    wait: z.boolean().optional(),
    x: z.number().optional(),
    y: z.number().optional(),
    anchorX: z.number().optional(),
    anchorY: z.number().optional(),
    scaleX: z.number().optional(),
    scaleY: z.number().optional(),
    flip: z.boolean().optional(),
    transition: z.enum(['instant', 'fade']).optional(),
    duration: z.number().optional(),
});

/* Flash */

export const FlashCommandSchema = z.object({
    type: z.literal('flash'),
    color: z.number().optional(),
    duration: z.number().optional(),
    wait: z.boolean().optional(),
});

/* Item */

export const ItemCommandSchema = z.object({
    type: z.literal('item'),
    action: z.enum(['add', 'remove', 'update']),
    id: z.string(),
    changes: z.record(z.string(), z.any()).optional(),
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

export const CommandSchema = z.discriminatedUnion('type', BuiltInCommandSchemas);

const BuiltInCommandSchemaRegistry: Record<string, z.ZodType> = {
    dialogue: DialogueCommandSchema,
    choice: ChoiceCommandSchema,
    background: BackgroundCommandSchema,
    bgm: BgmCommandSchema,
    sfx: SfxCommandSchema,
    transition: TransitionCommandSchema,
    scene_change: SceneChangeCommandSchema,
    shake: ShakeCommandSchema,
    wait: WaitCommandSchema,
    set: SetCommandSchema,
    if: IfCommandSchema,
    while: WhileCommandSchema,
    for: ForCommandSchema,
    jump: JumpCommandSchema,
    goto: GotoCommandSchema,
    label: LabelCommandSchema,
    block: BlockCommandSchema,
    call: CallCommandSchema,
    sprite: SpriteCommandSchema,
    flash: FlashCommandSchema,
    item: ItemCommandSchema,
};

type DiscriminatedOption = z.ZodTypeAny;

class SchemaRegistrySingleton {
    public readonly schemas: Record<string, z.ZodType>;

    constructor(initialSchemas: Record<string, z.ZodType>) {
        this.schemas = { ...initialSchemas };
    }

    register(type: string, schema: z.ZodType): void {
        this.schemas[type] = schema;
    }

    get(type: string): z.ZodType | undefined {
        return this.schemas[type];
    }

    getRegistry(): Record<string, z.ZodType> {
        return this.schemas;
    }

    getCommandSchema(): z.ZodType {
        const options = Object.values(this.schemas) as DiscriminatedOption[];
        const knownTypes = new Set(Object.keys(this.schemas));

        const UnknownCommandSchema = BaseCommandSchema.refine((cmd) => !knownTypes.has(cmd.type));

        if (options.length === 0) {
            return UnknownCommandSchema;
        }

        if (options.length === 1) {
            return z.union([options[0], UnknownCommandSchema]);
        }

        const KnownCommandSchema = z.discriminatedUnion('type', options as any);
        return z.union([KnownCommandSchema, UnknownCommandSchema]);
    }
}

export const SchemaRegistry = new SchemaRegistrySingleton(BuiltInCommandSchemaRegistry);

/* Backward-compatible alias used by editor introspection */
export const CommandSchemaRegistry = SchemaRegistry.getRegistry();

export const ScriptSchema = z.array(z.lazy(() => SchemaRegistry.getCommandSchema()));

/**
 * Validates an entire script array. Returns parsed commands or throws.
 */
export function validateScript(script: unknown[]): z.infer<typeof CommandSchema>[] {
    const commandSchema = SchemaRegistry.getCommandSchema();
    return script.map((cmd, i) => {
        const result = commandSchema.safeParse(cmd);
        if (!result.success) {
            console.warn(`[Schema] Invalid command at index ${i}:`, result.error.issues);
            return cmd;
        }
        return result.data;
    }) as any;
}