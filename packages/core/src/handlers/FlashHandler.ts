import { Graphics } from 'pixi.js';
import type { BaseCommand, CommandHandler } from '../types';
import type { Engine } from '../Engine';

export interface FlashCommand extends BaseCommand {
    type: 'flash';
    color?: number;
    duration?: number;
    wait?: boolean;
}

export class FlashHandler implements CommandHandler<FlashCommand> {
    public type = 'flash';
    public autoNext = true;

    execute = async (command: FlashCommand, engine: Engine) => {
        const color = command.color ?? 0xffffff;
        const duration = command.duration ?? 200;
        const wait = command.wait ?? false;

        const performFlash = () => {
            const rect = new Graphics()
                .rect(0, 0, engine.display.width, engine.display.height)
                .fill(color);
            rect.alpha = 1;

            engine.layers.overlay.addChild(rect);

            const startTime = performance.now();

            return new Promise<void>((resolve) => {
                const animate = (time: number) => {
                    const progress = Math.min((time - startTime) / duration, 1);
                    rect.alpha = 1 - progress;

                    if (progress < 1) {
                        requestAnimationFrame(animate);
                    } else {
                        rect.destroy();
                        resolve();
                    }
                };
                requestAnimationFrame(animate);
            });
        };

        if (wait) {
            await performFlash();
        } else {
            performFlash();
        }
    };
}