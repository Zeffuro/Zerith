import type { IFlowManager } from '../interfaces/managers';
import type { BaseCommand, CommandHandler } from '../types';

export interface ForCommand extends BaseCommand {
    body?: BaseCommand[];
    from?: number;
    iterator?: string;
    step?: number;
    to?: number;
    type: 'for';
}

export class ForHandler implements CommandHandler<ForCommand> {
    public autoNext = true;
    public type = 'for' as const;
    private readonly flow: IFlowManager;

    constructor(flow: IFlowManager) {
        this.flow = flow;
    }

    execute = (command: ForCommand) => {
        const iterator = command.iterator ?? 'i';
        const from = Number(command.from ?? 0);
        const to = Number(command.to ?? 0);
        let step = Number(command.step ?? 1);
        const body = Array.isArray(command.body) ? command.body : [];
        const commands: BaseCommand[] = [];

        if (!Number.isFinite(step) || step === 0) step = 1;

        const appendIteration = (value: number) => {
            commands.push(
                {
                    key: iterator,
                    type: 'set',
                    value,
                },
                ...body,
            );
        };

        if (step > 0) {
            for (let index = from; index <= to; index += step) {
                appendIteration(index);
            }
        } else {
            for (let index = from; index >= to; index += step) {
                appendIteration(index);
            }
        }

        this.flow.injectCommands(commands);
    };
}
