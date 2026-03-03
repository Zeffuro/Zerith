import { Graphics } from 'pixi.js';
import type { BaseCommand, CommandHandler } from '../types';
import type { Engine } from '../Engine';

export interface TransitionCommand extends BaseCommand {
    type: 'transition';
    action: 'fade_out' | 'fade_in';
    duration?: number;
}

export class TransitionHandler implements CommandHandler<TransitionCommand> {
    public type = 'transition';
    public autoNext = true;
    private fadeRect: Graphics | null = null;

    reset = () => {
        this.fadeRect = null;
    };

    execute = async (command: TransitionCommand, engine: Engine) => {
        const duration = command.duration || 500;

        if (!this.fadeRect) {
            this.fadeRect = new Graphics();
            this.fadeRect.rect(0, 0, engine.display.width, engine.display.height);
            this.fadeRect.fill(0x000000);
            engine.layers.overlay.addChild(this.fadeRect);
        }

        const startAlpha = command.action === 'fade_out' ? 0 : 1;
        const endAlpha = command.action === 'fade_out' ? 1 : 0;

        const startTime = performance.now();

        return new Promise<void>((resolve) => {
            const animate = (time: number) => {
                const elapsed = time - startTime;
                const progress = Math.min(elapsed / duration, 1);

                this.fadeRect!.alpha = startAlpha + (endAlpha - startAlpha) * progress;

                if (progress < 1) {
                    requestAnimationFrame(animate);
                } else {
                    resolve();
                }
            };
            requestAnimationFrame(animate);
        });
    };
}