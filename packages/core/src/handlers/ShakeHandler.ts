import gsap from 'gsap';

import type { IDisplayManager } from '../interfaces/managers';
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
    private readonly display: IDisplayManager;

    constructor(display: IDisplayManager) {
        this.display = display;
    }

    execute = async (command: ShakeCommand) => {
        const duration = (command.duration ?? 500) / 1000;
        const intensity = command.intensity ?? 10;
        const targets = [this.display.getLayer('background'), this.display.getLayer('sprites')];

        const tl = gsap.timeline();

        tl.to(targets, {
            duration: 0.05,
            onComplete: () => {
                gsap.set(targets, { x: 0, y: 0 });
            },
            repeat: Math.floor(duration / 0.05),
            x: `random(-${intensity}, ${intensity})`,
            y: `random(-${intensity}, ${intensity})`,
            yoyo: true
        });

        if (command.wait) await tl;
    };
}