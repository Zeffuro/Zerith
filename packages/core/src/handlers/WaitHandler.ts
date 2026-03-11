import type { BaseCommand, CommandHandler } from '../types';

export interface WaitCommand extends BaseCommand {
    duration: number;
    type: 'wait';
}

export class WaitHandler implements CommandHandler<WaitCommand> {
    public autoNext = true;
    public type = 'wait' as const;
    private timeoutId: ReturnType<typeof setTimeout> | undefined;

    constructor() {}

    public destroy(): void {
        this.reset();
    }

    execute = (command: WaitCommand) => {
        return new Promise<void>((resolve) => {
            this.timeoutId = setTimeout(() => {
                this.timeoutId = undefined;
                resolve();
            }, command.duration);
        });
    };


    public reset(): void {
        if (this.timeoutId !== undefined) {
            clearTimeout(this.timeoutId);
            this.timeoutId = undefined;
        }
    }
}