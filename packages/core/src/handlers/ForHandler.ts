import type { IFlowManager, IStateManager } from '../interfaces/managers';
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
    private readonly state: IStateManager;

    constructor(
        flow: IFlowManager,
        state: IStateManager,
    ) {
        this.flow = flow;
        this.state = state;
    }

    execute = async (command: ForCommand) => {
        const iterator = command.iterator ?? 'i';
        const from = Number(command.from ?? 0);
        const to = Number(command.to ?? 0);
        let step = Number(command.step ?? 1);
        const body = Array.isArray(command.body) ? command.body : [];

        if (!Number.isFinite(step) || step === 0) step = 1;

        const runBodyOnce = async (value: number) => {
            this.state.set(iterator, value);
            for (const child of body) {
                await this.flow.runCommand(child);
            }
        };

        if (step > 0) {
            for (let index = from; index <= to; index += step) {
                await runBodyOnce(index);
            }
        } else {
            for (let index = from; index >= to; index += step) {
                await runBodyOnce(index);
            }
        }
    };
}