import gsap from 'gsap';
import { Graphics } from 'pixi.js';

import type { Engine } from '../Engine';
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

    execute = async (command: FlashCommand, engine: Engine) => {
        const color = command.color ?? 0xFF_FF_FF;
        const duration = (command.duration ?? 200) / 1000;

        const rect = new Graphics()
            .rect(0, 0, engine.display.width, engine.display.height)
            .fill(color);

        engine.layers.overlay.addChild(rect);

        const tween = gsap.to(rect, {
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