import type { ISceneManager } from '../interfaces/managers';
import type { BaseCommand, CommandHandler } from '../types';

export interface JumpCommand extends BaseCommand {
    to: string;
    type: 'jump';
}

export class JumpHandler implements CommandHandler<JumpCommand> {
    public autoNext = true;
    public type = 'jump' as const;
    private readonly scenes: ISceneManager;

    constructor(scenes: ISceneManager) {
        this.scenes = scenes;
    }

    execute = async (command: JumpCommand) => {
        await this.scenes.jumpToScene(command.to);
    };
}