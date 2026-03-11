import { Graphics } from 'pixi.js';

import type { IAnimationManager, IDisplayManager } from '../interfaces/managers';
import type { BaseCommand, CommandHandler } from '../types';

export interface TransitionCommand extends BaseCommand {
    action: 'fade_in' | 'fade_out';
    duration?: number;
    type: 'transition';
}

export class TransitionHandler implements CommandHandler<TransitionCommand> {
    public autoNext = true;
    public type = 'transition' as const;
    private readonly animations: IAnimationManager;
    private readonly display: IDisplayManager;
    private fadeRect: Graphics | undefined;

    constructor(animations: IAnimationManager, display: IDisplayManager) {
        this.animations = animations;
        this.display = display;
    }

    public destroy(): void {
        this.reset();
    }

    execute = (command: TransitionCommand) => {
        const duration = (command.duration || 500) / 1000;

        if (!this.fadeRect) {
            this.fadeRect = new Graphics()
                .rect(0, 0, this.display.width, this.display.height)
                .fill(0x00_00_00);
            this.display.getLayer('overlay').addChild(this.fadeRect);
        }

        const fadeRect = this.fadeRect;
        const targetAlpha = command.action === 'fade_out' ? 1 : 0;

        return this.animations.to(fadeRect, {
            alpha: targetAlpha,
            duration: duration,
            ease: "power2.inOut",
        });
    };

    public reset(): void {
        if (this.fadeRect) {
            this.animations.killTweensOf(this.fadeRect);
        }
        this.fadeRect?.removeFromParent();
        this.fadeRect?.destroy();
        this.fadeRect = undefined;
    }
}