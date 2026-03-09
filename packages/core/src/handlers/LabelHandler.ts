import type { BaseCommand, CommandHandler } from '../types';

export interface LabelCommand extends BaseCommand {
    name: string;
    type: 'label';
}

export class LabelHandler implements CommandHandler<LabelCommand, unknown> {
    public autoNext = true;
    public type = 'label' as const;

    execute = () => {
        // Labels are no-ops at execution time.
        // They're used as targets by GotoHandler.
        return Promise.resolve();
    };
}