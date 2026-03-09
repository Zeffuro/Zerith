import type { SceneTemplateContext } from '../execution/ExecutionContext';
import type { BaseCommand, CommandHandler } from '../types';

export interface CallCommand extends BaseCommand {
    name: string;
    type: 'call';
}

export class CallHandler implements CommandHandler<CallCommand, SceneTemplateContext> {
    public autoNext = true;
    public type = 'call' as const;

    execute = (command: CallCommand, engine: SceneTemplateContext) => {
        const scenes = engine.getSystem('scenes');
        const template = scenes.getTemplate(command.name);
        if (template) {
            scenes.injectCommands(template);
        } else {
            engine.logger.warn(`Template '${command.name}' not found!`);
        }
        return Promise.resolve();
    };
}