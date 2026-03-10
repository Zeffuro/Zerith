import { Graphics } from 'pixi.js';

import type { IAnimationManager, IDisplayManager } from '../interfaces/managers';
import type { BaseCommand, CommandHandler } from '../types';

export interface FlashCommand extends BaseCommand {
    color?: number;
    duration?: number;
    type: 'flash';
    wait?: boolean;
}

export class FlashHandler implements CommandHandler<FlashCommand> {
    public autoNext = true;
    public type = 'flash' as const;
    private readonly animations: IAnimationManager;
    private readonly display: IDisplayManager;

    constructor(animations: IAnimationManager, display: IDisplayManager) {
        this.animations = animations;
        this.display = display;
    }

    execute = async (command: FlashCommand) => {
        const color = command.color ?? 0xFF_FF_FF;
        const duration = (command.duration ?? 200) / 1000;

        const rect = new Graphics()
            .rect(0, 0, this.display.width, this.display.height)
            .fill(color);

        this.display.getLayer('overlay').addChild(rect);

        const tween = this.animations.to(rect, {
            alpha: 0,
            duration: duration,
            ease: "power2.out",
            onComplete: () => rect.destroy()
        });

        if (command.wait) {
            await tween;
        }
    };
}