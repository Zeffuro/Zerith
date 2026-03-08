import gsap from 'gsap';
import type { BaseCommand, CommandHandler } from '../types';
import type { Engine } from '../Engine';

export interface ShakeCommand extends BaseCommand {
    type: 'shake';
    duration?: number;
    intensity?: number;
    wait?: boolean;
}

export class ShakeHandler implements CommandHandler<ShakeCommand> {
    public type: 'shake' = 'shake';
    public autoNext = true;

    execute = async (command: ShakeCommand, engine: Engine) => {
        const duration = (command.duration ?? 500) / 1000;
        const intensity = command.intensity ?? 10;
        const targets = [engine.layers.background, engine.layers.sprites];

        const tl = gsap.timeline();

        tl.to(targets, {
            x: `random(-${intensity}, ${intensity})`,
            y: `random(-${intensity}, ${intensity})`,
            duration: 0.05,
            repeat: Math.floor(duration / 0.05),
            yoyo: true,
            onComplete: () => {
                gsap.set(targets, { x: 0, y: 0 });
            }
        });

        if (command.wait) await tl;
    };
}