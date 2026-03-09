import type { SceneTemplateContext } from '../execution/ExecutionContext';
import type { BaseCommand, CommandHandler } from '../types';

export interface GotoCommand extends BaseCommand {
    label: string;
    type: 'goto';
}

export class GotoHandler implements CommandHandler<GotoCommand, SceneTemplateContext> {
    public autoNext = true;
    public type = 'goto' as const;

    execute = (command: GotoCommand, engine: SceneTemplateContext) => {
        const scenes = engine.getSystem('scenes');
        const script = scenes.script;
        const targetIndex = script.findIndex(
            (cmd) => cmd.type === 'label' && (cmd as unknown as { name: string }).name === command.label
        );

        if (targetIndex === -1) {
            engine.logger.warn(`Label '${command.label}' not found.`);
        } else {
            scenes.currentIndex = targetIndex;
        }
        return Promise.resolve();
    };
}