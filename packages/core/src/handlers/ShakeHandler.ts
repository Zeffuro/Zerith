import type { IAnimationManager, IDisplayManager } from '../interfaces/managers';
import type { BaseCommand, CommandHandler } from '../types';

export interface ShakeCommand extends BaseCommand {
    duration?: number;
    intensity?: number;
    type: 'shake';
    wait?: boolean;
}

export class ShakeHandler implements CommandHandler<ShakeCommand> {
    public autoNext = true;
    public type = 'shake' as const;
    private readonly animations: IAnimationManager;
    private readonly display: IDisplayManager;

    constructor(animations: IAnimationManager, display: IDisplayManager) {
        this.animations = animations;
        this.display = display;
    }

    public destroy(): void {
        this.reset();
    }

    execute = async (command: ShakeCommand) => {
        const duration = (command.duration ?? 500) / 1000;
        const intensity = command.intensity ?? 10;
        const targets = [this.display.getLayer('background'), this.display.getLayer('sprites')];

        const tl = this.animations.timeline() as {
            eventCallback(name: 'onComplete', callback: () => void): void;
            to(targets: unknown, variables: unknown): void;
        };

        tl.to(targets, {
            duration: 0.05,
            onComplete: () => {
                this.animations.set(targets, { x: 0, y: 0 });
            },
            repeat: Math.floor(duration / 0.05),
            x: `random(-${intensity}, ${intensity})`,
            y: `random(-${intensity}, ${intensity})`,
            yoyo: true
        });

        if (command.wait) {
            await new Promise<void>((resolve) => {
                tl.eventCallback('onComplete', resolve);
            });
        }
    };

    public reset(): void {
        const targets = [this.display.getLayer('background'), this.display.getLayer('sprites')];
        this.animations.set(targets, { x: 0, y: 0 });
    }
}