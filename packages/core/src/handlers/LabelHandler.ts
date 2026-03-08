import type { Engine } from '../Engine';
import type { BaseCommand, CommandHandler } from '../types';

export interface LabelCommand extends BaseCommand {
    name: string;
    type: 'label';
}

export class LabelHandler implements CommandHandler<LabelCommand> {
    public autoNext = true;
    public type: 'label' = 'label';

    execute = async (_command: LabelCommand, _engine: Engine) => {
        // Labels are no-ops at execution time.
        // They're used as targets by GotoHandler.
    };
}