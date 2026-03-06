import { Graphics } from 'pixi.js';
import gsap from 'gsap';
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

    execute = async (command: TransitionCommand, engine: Engine) => {
        const duration = (command.duration || 500) / 1000;

        if (!this.fadeRect) {
            this.fadeRect = new Graphics()
                .rect(0, 0, engine.display.width, engine.display.height)
                .fill(0x000000);
            engine.layers.overlay.addChild(this.fadeRect);
        }

        const targetAlpha = command.action === 'fade_out' ? 1 : 0;

        return new Promise<void>((resolve) => {
            gsap.to(this.fadeRect, {
                alpha: targetAlpha,
                duration: duration,
                ease: "power2.inOut",
                onComplete: resolve
            });
        });
    };
}