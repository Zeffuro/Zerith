import type { ExecutionContext } from '../execution/ExecutionContext';
import type { ICommandHandler } from '../interfaces/ICommandHandler';

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

export type CommandHandler<
    T extends BaseCommand = BaseCommand,
    C = ExecutionContext,
> = ICommandHandler<T, C>;

export type CommandType = ({} & string) | typeof BuiltInCommandTypes[number];

export type SceneMap = Record<string, Script>;

export type SceneNavigationCommandType = 'call' | 'jump' | 'scene_change';

export type Script = BaseCommand[];
