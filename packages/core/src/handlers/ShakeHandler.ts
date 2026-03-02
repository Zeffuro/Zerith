import type { BaseCommand, CommandHandler } from '../types';
import type { Engine } from '../Engine';

export interface ShakeCommand extends BaseCommand {
    type: 'shake';
    duration?: number;
    intensity?: number;
    wait?: boolean;
}

export class ShakeHandler implements CommandHandler<ShakeCommand> {
    public type = 'shake';
    public autoNext = true;

    execute = async (command: ShakeCommand, engine: Engine) => {
        const duration = command.duration ?? 500;
        const intensity = command.intensity ?? 10;
        const wait = command.wait ?? false;

        const targets =[engine.layers.background, engine.layers.sprites];

        const performShake = () => new Promise<void>((resolve) => {
            const startTime = performance.now();

            const animate = (time: number) => {
                const elapsed = time - startTime;

                if (elapsed < duration) {
                    const offsetX = (Math.random() * 2 - 1) * intensity;
                    const offsetY = (Math.random() * 2 - 1) * intensity;

                    targets.forEach(t => t.position.set(offsetX, offsetY));
                    requestAnimationFrame(animate);
                } else {
                    targets.forEach(t => t.position.set(0, 0));
                    resolve();
                }
            };
            requestAnimationFrame(animate);
        });

        if (wait) {
            await performShake();
        } else {
            performShake();
        }
    };
}