import type { Engine } from '../Engine';
import type { BaseCommand, CommandHandler } from '../types';

export interface WaitCommand extends BaseCommand {
    duration: number;
    type: 'wait';
}

export class WaitHandler implements CommandHandler<WaitCommand> {
    public autoNext = true;
    public type: 'wait' = 'wait';

    execute = async (command: WaitCommand, _engine: Engine) => {
        await new Promise(resolve => setTimeout(resolve, command.duration));
    };
}