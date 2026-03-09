import type { SceneInjectionContext } from '../execution/ExecutionContext';
import type { BaseCommand, CommandHandler } from '../types';

export interface BlockCommand extends BaseCommand {
    commands: BaseCommand[];
    type: 'block';
}

export class BlockHandler implements CommandHandler<BlockCommand, SceneInjectionContext> {
    public autoNext = true;
    public type = 'block' as const;

    execute = (command: BlockCommand, engine: SceneInjectionContext) => {
        engine.getSystem('scenes').injectCommands(command.commands);
        return Promise.resolve();
    };
}