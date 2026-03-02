import type { BaseCommand, CommandHandler } from '../types';
import type { Engine } from '../Engine';

export interface CallCommand extends BaseCommand {
    type: 'call';
    name: string;
}

export class CallHandler implements CommandHandler<CallCommand> {
    public type = 'call';
    public autoNext = true;

    execute = async (command: CallCommand, engine: Engine) => {
        const template = engine.getTemplate(command.name);
        if (template) {
            engine.injectCommands(template);
        } else {
            engine.logger.warn(`Template '${command.name}' not found!`);
        }
    };
}