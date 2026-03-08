import gsap from 'gsap';
import { Graphics } from 'pixi.js';

import type { Engine } from '../Engine';
import type { BaseCommand, CommandHandler } from '../types';

export interface TransitionCommand extends BaseCommand {
    action: 'fade_in' | 'fade_out';
    duration?: number;
    type: 'transition';
}

export class TransitionHandler implements CommandHandler<TransitionCommand> {
    public autoNext = true;
    public type = 'transition' as const;
    private fadeRect: Graphics | undefined;

    execute = (command: TransitionCommand, engine: Engine) => {
        const duration = (command.duration || 500) / 1000;

        if (!this.fadeRect) {
            this.fadeRect = new Graphics()
                .rect(0, 0, engine.display.width, engine.display.height)
                .fill(0x00_00_00);
            engine.layers.overlay.addChild(this.fadeRect);
        }

        const targetAlpha = command.action === 'fade_out' ? 1 : 0;

        return new Promise<void>((resolve) => {
            gsap.to(this.fadeRect!, {
                alpha: targetAlpha,
                duration: duration,
                ease: "power2.inOut",
                onComplete: resolve
            });
        });
    };
}