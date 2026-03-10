import { Container, Graphics, Text } from 'pixi.js';

import type { IDisplayManager } from '../interfaces/managers';
import type { IThemeProvider } from '../interfaces/providers';

export interface NotificationConfig {
    backgroundAlpha?: number;
    backgroundColor?: number;
    duration?: number;
    fadeTime?: number;
    fontFamily?: string;
    fontSize?: number;
    height?: number;
    textColor?: number;
    width?: number;
}

export interface NotificationDeps {
    display: Pick<IDisplayManager, 'width'>;
    overlayLayer: Container;
    themeProvider: IThemeProvider;
}

export class NotificationManager {
    private readonly config: Required<NotificationConfig>;
    private readonly deps: NotificationDeps;

    constructor(deps: NotificationDeps, config: NotificationConfig = {}) {
        this.deps = deps;
        this.config = {
            backgroundAlpha: 0.8,
            backgroundColor: 0x00_00_00,
            duration: 2000,
            fadeTime: 200,
            fontFamily: 'Arial',
            fontSize: 16,
            height: 40,
            textColor: 0xFF_FF_FF,
            width: 250,
            ...config
        };
    }

    public show(message: string) {
        const { backgroundAlpha, backgroundColor, duration, fadeTime, fontFamily, fontSize, height, textColor, width } = this.config;
        const { display, overlayLayer, themeProvider } = this.deps;

        const toast = new Container();
        const bg = new Graphics()
            .roundRect(0, 0, width, height, 8)
            .fill({ alpha: backgroundAlpha, color: backgroundColor })
            .stroke({ color: themeProvider.getTheme().borderColor, width: 1 });

        const txt = new Text({
            style: { fill: textColor, fontFamily, fontSize },
            text: message
        });
        txt.anchor.set(0.5);
        txt.position.set(width / 2, height / 2);

        toast.addChild(bg, txt);
        toast.position.set(display.width - width - 20, 20);
        toast.alpha = 0;

        overlayLayer.addChild(toast);

        const startTime = performance.now();
        const animate = (time: number) => {
            if (toast.destroyed) return;

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