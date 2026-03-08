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

export type CommandType = (typeof BuiltInCommandTypes)[number];
export type SceneNavigationCommandType = Extract<CommandType, 'jump' | 'scene_change'>;

export interface BaseCommand {
    type: CommandType;
    [key: string]: any;
}

export interface CommandHandler<TCmd extends BaseCommand = BaseCommand> {
    type: CommandType;
    autoNext?: boolean;
    execute: (command: TCmd, engine: Engine) => Promise<void>;
    reset?: () => void;
}

export type Script = BaseCommand[];
export type SceneMap = Record<string, Script>;