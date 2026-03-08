import { Graphics } from 'pixi.js';
import gsap from 'gsap';
import type { BaseCommand, CommandHandler } from '../types';
import type { Engine } from '../Engine';

export interface FlashCommand extends BaseCommand {
    type: 'flash';
    color?: number;
    duration?: number;
    wait?: boolean;
}

export class FlashHandler implements CommandHandler<FlashCommand> {
    public type: 'flash' = 'flash';
    public autoNext = true;

    execute = async (command: FlashCommand, engine: Engine) => {
        const color = command.color ?? 0xffffff;
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