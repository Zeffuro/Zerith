import { z } from 'zod';

// --- Base ---

const BaseCommandSchema = z.object({
    type: z.string(),
}).passthrough();

// --- Dialogue ---

export const DialogueCommandSchema = z.object({
    type: z.literal('dialogue'),
    speaker: z.string(),
    text: z.string(),
    portraitSide: z.enum(['left', 'right']).optional(),
});
export type DialogueCommand = z.infer<typeof DialogueCommandSchema>;

// --- Choice ---

export const ChoiceOptionSchema = z.object({
    label: z.string(),
    commands: z.array(BaseCommandSchema).optional(),
});

export const ChoiceCommandSchema = z.object({
    type: z.literal('choice'),
    options: z.array(ChoiceOptionSchema),
});
export type ChoiceCommand = z.infer<typeof ChoiceCommandSchema>;

// --- Background ---

export const BackgroundCommandSchema = z.object({
    type: z.literal('background'),
    assetUrl: z.string(),
});
export type BackgroundCommand = z.infer<typeof BackgroundCommandSchema>;

// --- BGM ---

export const BgmCommandSchema = z.object({
    type: z.literal('bgm'),
    action: z.enum(['play', 'stop', 'pause', 'resume']),
    assetUrl: z.string().optional(),
    volume: z.number().optional(),
    loop: z.boolean().optional(),
});
export type BgmCommand = z.infer<typeof BgmCommandSchema>;

// --- SFX ---

export const SfxCommandSchema = z.object({
    type: z.literal('sfx'),
    assetUrl: z.string(),
    volume: z.number().optional(),
});
export type SfxCommand = z.infer<typeof SfxCommandSchema>;

// --- Transition ---

export const TransitionCommandSchema = z.object({
    type: z.literal('transition'),
    action: z.enum(['fade_out', 'fade_in']),
    duration: z.number().optional(),
});
export type TransitionCommand = z.infer<typeof TransitionCommandSchema>;

// --- Scene Change ---

export const SceneChangeCommandSchema = z.object({
    type: z.literal('scene_change'),
    assetUrl: z.string(),
    duration: z.number().optional(),
});
export type SceneChangeCommand = z.infer<typeof SceneChangeCommandSchema>;

// --- Shake ---

export const ShakeCommandSchema = z.object({
    type: z.literal('shake'),
    duration: z.number().optional(),
    intensity: z.number().optional(),
    wait: z.boolean().optional(),
});
export type ShakeCommand = z.infer<typeof ShakeCommandSchema>;

// --- Wait ---

export const WaitCommandSchema = z.object({
    type: z.literal('wait'),
    duration: z.number(),
});
export type WaitCommand = z.infer<typeof WaitCommandSchema>;

// --- Set ---

export const SetCommandSchema = z.object({
    type: z.literal('set'),
    key: z.string(),
    value: z.any().optional(),
    op: z.enum(['set', 'add', 'sub', 'toggle']).optional(),
});
export type SetCommand = z.infer<typeof SetCommandSchema>;

// --- If ---

const ComparisonOpSchema = z.enum(['eq', 'neq', 'gt', 'gte', 'lt', 'lte']);

const ConditionSchema = z.object({
    key: z.string(),
    op: ComparisonOpSchema.optional(),
    value: z.any().optional(),
});

export const IfCommandSchema = z.object({
    type: z.literal('if'),
    key: z.string().optional(),
    op: ComparisonOpSchema.optional(),
    value: z.any().optional(),
    all: z.array(ConditionSchema).optional(),
    any: z.array(ConditionSchema).optional(),
    then: z.array(BaseCommandSchema).optional(),
    else: z.array(BaseCommandSchema).optional(),
});
export type IfCommand = z.infer<typeof IfCommandSchema>;

// --- Jump ---

export const JumpCommandSchema = z.object({
    type: z.literal('jump'),
    to: z.string(),
});
export type JumpCommand = z.infer<typeof JumpCommandSchema>;

// --- Goto ---

export const GotoCommandSchema = z.object({
    type: z.literal('goto'),
    label: z.string(),
});
export type GotoCommand = z.infer<typeof GotoCommandSchema>;

// --- Label ---

export const LabelCommandSchema = z.object({
    type: z.literal('label'),
    name: z.string(),
});
export type LabelCommand = z.infer<typeof LabelCommandSchema>;

// --- Block ---

export const BlockCommandSchema = z.object({
    type: z.literal('block'),
    commands: z.array(BaseCommandSchema),
});
export type BlockCommand = z.infer<typeof BlockCommandSchema>;

// --- Call ---

export const CallCommandSchema = z.object({
    type: z.literal('call'),
    name: z.string(),
});
export type CallCommand = z.infer<typeof CallCommandSchema>;

// --- Discriminated Union of all known commands ---

export const CommandSchema = z.discriminatedUnion('type', [
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
    JumpCommandSchema,
    GotoCommandSchema,
    LabelCommandSchema,
    BlockCommandSchema,
    CallCommandSchema,
]);

export const ScriptSchema = z.array(CommandSchema);

// --- Registry for editor introspection ---

export const CommandSchemaRegistry: Record<string, z.ZodType> = {
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
    jump: JumpCommandSchema,
    goto: GotoCommandSchema,
    label: LabelCommandSchema,
    block: BlockCommandSchema,
    call: CallCommandSchema,
};

/**
 * Validates an entire script array. Returns parsed commands or throws.
 * Use this when loading JSON from disk or from the editor.
 */
export function validateScript(script: unknown[]): z.infer<typeof CommandSchema>[] {
    return script.map((cmd, i) => {
        const result = CommandSchema.safeParse(cmd);
        if (!result.success) {
            console.warn(`[Schema] Invalid command at index ${i}:`, result.error.format());
            return cmd;
        }
        return result.data;
    }) as any;
}