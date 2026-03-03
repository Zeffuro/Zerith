import type { BaseCommand, CommandHandler } from '../types';
import type { Engine } from '../Engine';

export interface GotoCommand extends BaseCommand {
    type: 'goto';
    label: string;
}

export class GotoHandler implements CommandHandler<GotoCommand> {
    public type = 'goto';
    public autoNext = true;

    execute = async (command: GotoCommand, engine: Engine) => {
        const script = engine.scenes.script;
        const targetIndex = script.findIndex(
            cmd => cmd.type === 'label' && (cmd as any).name === command.label
        );

        if (targetIndex !== -1) {
            engine.scenes.currentIndex = targetIndex + 1;
        } else {
            engine.logger.warn(`Label '${command.label}' not found in current scene.`);
        }
    };
}