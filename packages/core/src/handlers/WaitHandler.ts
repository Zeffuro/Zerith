import type { BaseCommand, CommandHandler } from '../types';

export interface WaitCommand extends BaseCommand {
    duration: number;
    type: 'wait';
}

export class WaitHandler implements CommandHandler<WaitCommand> {
    public autoNext = true;
    public type = 'wait' as const;

    constructor() {}

    execute = (command: WaitCommand) => {
        return new Promise<void>(resolve => setTimeout(resolve, command.duration));
    };
}