import type { BaseCommand, CommandHandler } from '../types';
import type { Engine } from '../Engine';

export interface BlockCommand extends BaseCommand {
    type: 'block';
    commands: BaseCommand[];
}

export class BlockHandler implements CommandHandler<BlockCommand> {
    public type = 'block';
    public autoNext = true;

    execute = async (command: BlockCommand, engine: Engine) => {
        engine.injectCommands(command.commands);
    };
}