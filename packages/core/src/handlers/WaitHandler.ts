import type { BaseCommand, CommandHandler } from '../types';

export interface WaitCommand extends BaseCommand {
    duration: number;
    type: 'wait';
}

export class WaitHandler implements CommandHandler<WaitCommand> {
    public autoNext = true;
    public type = 'wait' as const;
    private activeResolve: (() => void) | undefined;
    private activeWaitToken = 0;
    private destroyed = false;
    private timeoutId: ReturnType<typeof setTimeout> | undefined;

    constructor() {}

    public destroy(): void {
        this.destroyed = true;
        this.reset();
    }

    execute = (command: WaitCommand) => {
        this.destroyed = false;
        this.cancelActiveWait(true);

        if (command.duration <= 0) {
            return Promise.resolve();
        }

        const waitToken = ++this.activeWaitToken;

        return new Promise<void>((resolve) => {
            this.activeResolve = resolve;

            this.timeoutId = setTimeout(() => {
                if (this.destroyed || waitToken !== this.activeWaitToken) {
                    return;
                }

                this.timeoutId = undefined;
                this.activeResolve = undefined;
                resolve();
            }, command.duration);
        });
    };


    public reset(): void {
        this.cancelActiveWait(true);
    }

    private cancelActiveWait(resolvePending: boolean): void {
        if (this.timeoutId !== undefined) {
            clearTimeout(this.timeoutId);
            this.timeoutId = undefined;
        }

        const resolve = this.activeResolve;
        this.activeResolve = undefined;
        this.activeWaitToken++;

        if (resolvePending && resolve) {
            resolve();
        }
    }
}