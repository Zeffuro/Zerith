import type { IFlowManager } from '../interfaces/managers';
import type { BaseCommand, CommandHandler } from '../types';

export interface BlockCommand extends BaseCommand {
    commands: BaseCommand[];
    type: 'block';
}

export class BlockHandler implements CommandHandler<BlockCommand> {
    public autoNext = true;
    public type = 'block' as const;
    private readonly flow: IFlowManager;

    constructor(flow: IFlowManager) {
        this.flow = flow;
    }

    execute = (command: BlockCommand) => {
        this.flow.injectCommands(command.commands);
        return Promise.resolve();
    };
}