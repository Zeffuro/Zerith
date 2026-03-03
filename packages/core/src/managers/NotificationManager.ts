import { Container, Graphics, Text } from 'pixi.js';
import type { Engine } from '../Engine';

export interface NotificationConfig {
    width?: number;
    height?: number;
    duration?: number;
    fadeTime?: number;
    fontSize?: number;
    fontFamily?: string;
    backgroundColor?: number;
    backgroundAlpha?: number;
    textColor?: number;
}

export class NotificationManager {
    private engine: Engine;
    private config: Required<NotificationConfig>;

    constructor(engine: Engine, config: NotificationConfig = {}) {
        this.engine = engine;
        this.config = {
            width: 250,
            height: 40,
            duration: 2000,
            fadeTime: 200,
            fontSize: 16,
            fontFamily: 'Arial',
            backgroundColor: 0x000000,
            backgroundAlpha: 0.8,
            textColor: 0xffffff,
            ...config
        };
    }

    public show(message: string) {
        const { width, height, duration, fadeTime, fontSize, fontFamily, backgroundColor, backgroundAlpha, textColor } = this.config;

        const toast = new Container();
        const bg = new Graphics()
            .roundRect(0, 0, width, height, 8)
            .fill({ color: backgroundColor, alpha: backgroundAlpha })
            .stroke({ color: this.engine.theme.borderColor, width: 1 });

        const txt = new Text({
            text: message,
            style: { fill: textColor, fontSize, fontFamily }
        });
        txt.anchor.set(0.5);
        txt.position.set(width / 2, height / 2);

        toast.addChild(bg, txt);
        toast.position.set(this.engine.display.width - width - 20, 20);
        toast.alpha = 0;

        this.engine.layers.overlay.addChild(toast);

        const startTime = performance.now();
        const animate = (time: number) => {
            const elapsed = time - startTime;
            if (elapsed < fadeTime) {
                toast.alpha = elapsed / fadeTime;
            } else if (elapsed > duration - fadeTime) {
                toast.alpha = (duration - elapsed) / fadeTime;
            } else {
                toast.alpha = 1;
            }

            if (elapsed < duration) {
                requestAnimationFrame(animate);
            } else {
                toast.destroy({ children: true });
            }
        };
        requestAnimationFrame(animate);
    }
}