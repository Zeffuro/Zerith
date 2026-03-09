import type { ExecutionContext } from '../execution/ExecutionContext';
import type { BaseCommand, CommandHandler } from '../types';

export interface JumpCommand extends BaseCommand {
    to: string;
    type: 'jump';
}

export class JumpHandler implements CommandHandler<JumpCommand> {
    public autoNext = true;
    public type = 'jump' as const;

    execute = async (command: JumpCommand, engine: ExecutionContext) => {
        await engine.scenes.jumpToScene(command.to);
    };
}