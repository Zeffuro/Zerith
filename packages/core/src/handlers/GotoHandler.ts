import type { ISceneManager } from '../interfaces/managers';
import type { BaseCommand, CommandHandler } from '../types';
import type { Logger } from '../utils/Logger';

export interface GotoCommand extends BaseCommand {
    label: string;
    type: 'goto';
}

export class GotoHandler implements CommandHandler<GotoCommand> {
    public autoNext = true;
    public type = 'goto' as const;
    private readonly logger: Logger;
    private readonly scenes: ISceneManager;

    constructor(
        logger: Logger,
        scenes: ISceneManager,
    ) {
        this.logger = logger;
        this.scenes = scenes;
    }

    execute = (command: GotoCommand) => {
        const script = this.scenes.script;
        const targetIndex = script.findIndex(
            (cmd: BaseCommand) => cmd.type === 'label' && (cmd as { name?: string }).name === command.label
        );

        if (targetIndex === -1) {
            this.logger.warn(`Label '${command.label}' not found.`);
        } else {
            this.scenes.currentIndex = targetIndex;
        }
        return Promise.resolve();
    };
}