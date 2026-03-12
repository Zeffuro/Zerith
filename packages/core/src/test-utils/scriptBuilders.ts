import type { BaseCommand } from '../types';

export function scriptOf(...commands: BaseCommand[]): BaseCommand[] {
    return commands;
}

export function waitCommand(overrides: Partial<BaseCommand> = {}): BaseCommand {
    return {
        duration: 0,
        type: 'wait',
        ...overrides,
    } as BaseCommand;
}
