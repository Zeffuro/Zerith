import type { BaseCommand, CommandHandler } from '../types';
import type { Engine } from '../Engine';

export interface LabelCommand extends BaseCommand {
    type: 'label';
    name: string;
}

export class LabelHandler implements CommandHandler<LabelCommand> {
    public type: 'label' = 'label';
    public autoNext = true;

    execute = async (_command: LabelCommand, _engine: Engine) => {
        // Labels are no-ops at execution time.
        // They're used as targets by GotoHandler.
    };
}