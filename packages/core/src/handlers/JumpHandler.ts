import type { BaseCommand, CommandHandler } from '../types';
import type { Engine } from '../Engine';

export interface JumpCommand extends BaseCommand {
    type: 'jump';
    to: string;
}

export class JumpHandler implements CommandHandler<JumpCommand> {
    public type = 'jump';
    public autoNext = true;

    execute = async (command: JumpCommand, engine: Engine) => {
        await engine.jumpToScene(command.to);
    };
}