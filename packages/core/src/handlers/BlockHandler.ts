import type { ExecutionContext } from '../execution/ExecutionContext';
import type { BaseCommand, CommandHandler } from '../types';

export interface BlockCommand extends BaseCommand {
    commands: BaseCommand[];
    type: 'block';
}

export class BlockHandler implements CommandHandler<BlockCommand> {
    public autoNext = true;
    public type = 'block' as const;

    execute = (command: BlockCommand, engine: ExecutionContext) => {
        engine.scenes.injectCommands(command.commands);
        return Promise.resolve();
    };
}