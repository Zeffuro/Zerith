import type { ExecutionContext } from '../execution/ExecutionContext';
import type { BaseCommand, CommandHandler } from '../types';

export interface CallCommand extends BaseCommand {
    name: string;
    type: 'call';
}

export class CallHandler implements CommandHandler<CallCommand> {
    public autoNext = true;
    public type = 'call' as const;

    execute = (command: CallCommand, engine: ExecutionContext) => {
        const template = engine.scenes.getTemplate(command.name);
        if (template) {
            engine.scenes.injectCommands(template);
        } else {
            engine.logger.warn(`Template '${command.name}' not found!`);
        }
        return Promise.resolve();
    };
}