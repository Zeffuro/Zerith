import type { Engine } from '../Engine';

export interface BaseCommand {
    type: string;
    [key: string]: any;
}

export interface CommandHandler<TCmd extends BaseCommand = BaseCommand> {
    type: string;
    autoNext?: boolean;
    execute: (command: TCmd, engine: Engine) => Promise<void>;
    reset?: () => void;
}

export type Script = BaseCommand[];
export type SceneMap = Record<string, Script>;