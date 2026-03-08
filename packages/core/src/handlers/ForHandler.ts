import type { Engine } from '../Engine';
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
    public type: 'for' = 'for';

    execute = async (command: ForCommand, engine: Engine) => {
        const iterator = command.iterator ?? 'i';
        const from = Number(command.from ?? 0);
        const to = Number(command.to ?? 0);
        let step = Number(command.step ?? 1);
        const body = Array.isArray(command.body) ? command.body : [];

        if (!Number.isFinite(step) || step === 0) step = 1;

        const runBodyOnce = async (value: number) => {
            engine.setState(iterator, value);
            for (const child of body) {
                await engine.runCommand(child);
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