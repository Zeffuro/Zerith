import type { Engine } from '../Engine';
import type { BaseCommand, CommandHandler } from '../types';

export interface GotoCommand extends BaseCommand {
    label: string;
    type: 'goto';
}

export class GotoHandler implements CommandHandler<GotoCommand> {
    public autoNext = true;
    public type = 'goto' as const;

    execute = (command: GotoCommand, engine: Engine) => {
        const script = engine.scenes.script;
        const targetIndex = script.findIndex(
            (cmd) => cmd.type === 'label' && (cmd as unknown as { name: string }).name === command.label
        );

        if (targetIndex === -1) {
            engine.logger.warn(`Label '${command.label}' not found.`);
        } else {
            engine.scenes.currentIndex = targetIndex;
        }
        return Promise.resolve();
    };
}