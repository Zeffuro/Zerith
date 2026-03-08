export const BuiltInCommandTypes = [
    'dialogue',
    'choice',
    'background',
    'bgm',
    'sfx',
    'transition',
    'scene_change',
    'shake',
    'wait',
    'set',
    'if',
    'while',
    'for',
    'jump',
    'goto',
    'label',
    'block',
    'call',
    'sprite',
    'flash',
    'item',
] as const;

export interface BaseCommand {
    [key: string]: unknown;
    type: CommandType;
}

export interface CommandHandler<T extends BaseCommand> {
    autoNext?: boolean;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    execute: (command: T, engine: any) => Promise<void>;
    reset?: () => void;
    type: T['type'];
}

export type CommandType = ({} & string) | typeof BuiltInCommandTypes[number];

export type SceneMap = Record<string, Script>;

export type SceneNavigationCommandType = 'call' | 'jump' | 'scene_change';

export type Script = BaseCommand[];
