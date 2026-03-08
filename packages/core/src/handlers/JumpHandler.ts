import type { Engine } from '../Engine';
import type { BaseCommand, CommandHandler } from '../types';

export interface JumpCommand extends BaseCommand {
    to: string;
    type: 'jump';
}

export class JumpHandler implements CommandHandler<JumpCommand> {
    public autoNext = true;
    public type: 'jump' = 'jump';

    execute = async (command: JumpCommand, engine: Engine) => {
        await engine.scenes.jumpToScene(command.to);
    };
}