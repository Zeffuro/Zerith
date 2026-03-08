import type { Engine } from '../Engine';
import type { BaseCommand, CommandHandler } from '../types';

export interface BlockCommand extends BaseCommand {
    commands: BaseCommand[];
    type: 'block';
}

export class BlockHandler implements CommandHandler<BlockCommand> {
    public autoNext = true;
    public type: 'block' = 'block';

    execute = async (command: BlockCommand, engine: Engine) => {
        engine.scenes.injectCommands(command.commands);
    };
}