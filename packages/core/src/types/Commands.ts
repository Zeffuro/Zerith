import type { Engine } from '../Engine';

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
    [key: string]: any;
    type: CommandType;
}
export interface CommandHandler<TCmd extends BaseCommand = BaseCommand> {
    autoNext?: boolean;
    execute: (command: TCmd, engine: Engine) => Promise<void>;
    reset?: () => void;
    type: CommandType;
}

export type CommandType = (typeof BuiltInCommandTypes)[number];

export type SceneMap = Record<string, Script>;

export type SceneNavigationCommandType = Extract<CommandType, 'jump' | 'scene_change'>;
export type Script = BaseCommand[];