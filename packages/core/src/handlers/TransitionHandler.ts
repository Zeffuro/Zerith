import gsap from 'gsap';
import { Graphics } from 'pixi.js';

import type { VisualEffectContext } from '../execution/ExecutionContext';
import type { BaseCommand, CommandHandler } from '../types';

export interface TransitionCommand extends BaseCommand {
    action: 'fade_in' | 'fade_out';
    duration?: number;
    type: 'transition';
}

export class TransitionHandler implements CommandHandler<TransitionCommand, VisualEffectContext> {
    public autoNext = true;
    public type = 'transition' as const;
    private fadeRect: Graphics | undefined;

    execute = (command: TransitionCommand, engine: VisualEffectContext) => {
        const display = engine.getSystem('display');
        const duration = (command.duration || 500) / 1000;

        if (!this.fadeRect) {
            this.fadeRect = new Graphics()
                .rect(0, 0, display.width, display.height)
                .fill(0x00_00_00);
            engine.getLayer('overlay').addChild(this.fadeRect);
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