import type { BaseCommand, CommandHandler } from '../types';
import type { Engine } from '../Engine';

export interface ForCommand extends BaseCommand {
    type: 'for';
    iterator?: string;
    from?: number;
    to?: number;
    step?: number;
    body?: BaseCommand[];
}

export class ForHandler implements CommandHandler<ForCommand> {
    public type = 'for';
    public autoNext = true;

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
                await engine.runCommand(child as BaseCommand);
            }
        };

        if (step > 0) {
            for (let i = from; i <= to; i += step) {
                await runBodyOnce(i);
            }
        } else {
            for (let i = from; i >= to; i += step) {
                await runBodyOnce(i);
            }
        }
    };
}