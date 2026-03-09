import type { IFlowManager, ISceneManager } from '../interfaces/managers';
import type { BaseCommand, CommandHandler } from '../types';
import type { Logger } from '../utils/Logger';

export interface CallCommand extends BaseCommand {
    name: string;
    type: 'call';
}

export class CallHandler implements CommandHandler<CallCommand> {
    public autoNext = true;
    public type = 'call' as const;
    private readonly flow: IFlowManager;
    private readonly logger: Logger;
    private readonly scenes: ISceneManager;

    constructor(
        logger: Logger,
        scenes: ISceneManager,
        flow: IFlowManager,
    ) {
        this.logger = logger;
        this.scenes = scenes;
        this.flow = flow;
    }

    execute = (command: CallCommand) => {
        const template = this.scenes.getTemplate(command.name);
        if (template) {
            this.flow.injectCommands(template);
        } else {
            this.logger.warn(`Template '${command.name}' not found!`);
        }
        return Promise.resolve();
    };
}