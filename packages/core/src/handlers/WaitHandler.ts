import type { BaseCommand, CommandHandler } from '../types';
import type { Engine } from '../Engine';

export interface WaitCommand extends BaseCommand {
    type: 'wait';
    duration: number;
}

export class WaitHandler implements CommandHandler<WaitCommand> {
    public type = 'wait';
    public autoNext = true;

    execute = async (command: WaitCommand, _engine: Engine) => {
        await new Promise(resolve => setTimeout(resolve, command.duration));
    };
}