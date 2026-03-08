import { Container, Graphics, Text, type TextStyleFontWeight } from 'pixi.js';

import type { Engine } from '../Engine';

export interface StartScreenConfig {
    backgroundAlpha?: number;
    backgroundColor?: number;
    fontFamily?: string;
    fontSize?: number;
    fontWeight?: TextStyleFontWeight;
    pulseMax?: number;
    pulseMin?: number;
    pulseSpeed?: number;
    text?: string;
    textColor?: number;
}

export class StartScreenManager {
    private readonly config: Required<StartScreenConfig>;
    private engine: Engine;

    constructor(engine: Engine, config: StartScreenConfig = {}) {
        this.engine = engine;
        this.config = {
            backgroundAlpha: 0.85,
            backgroundColor: 0x00_00_00,
            fontFamily: 'Arial',
            fontSize: 36,
            fontWeight: 'bold' as TextStyleFontWeight,
            pulseMax: 1,
            pulseMin: 0.6,
            pulseSpeed: 500,
            text: 'CLICK TO START',
            textColor: 0xFF_FF_FF,
            ...config
        };
    }

    /**
     * Shows a "click to start" overlay, waits for user interaction,
     * then jumps to the given scene and starts the engine.
     * Browsers require a user gesture before playing audio,
     * so this should be the standard entry point.
     */
    public show(startScene: string): Promise<void> {
        const w = this.engine.display.width;
        const h = this.engine.display.height;
        const cfg = this.config;

        const startLayer = new Container();
        const overlayBg = new Graphics()
            .rect(0, 0, w, h)
            .fill({ alpha: cfg.backgroundAlpha, color: cfg.backgroundColor });

        const startTxt = new Text({
            style: {
                fill: cfg.textColor,
                fontFamily: cfg.fontFamily,
                fontSize: cfg.fontSize,
                fontWeight: cfg.fontWeight
            },
            text: cfg.text
        });
        startTxt.anchor.set(0.5);
        startTxt.position.set(w / 2, h / 2);

        startLayer.addChild(overlayBg, startTxt);
        startLayer.eventMode = 'static';
        startLayer.cursor = 'pointer';
        this.engine.layers.overlay.addChild(startLayer);

        const { pulseMax, pulseMin, pulseSpeed } = cfg;
        const pulseRange = pulseMax - pulseMin;
        const animate = () => {
            if (startLayer.destroyed) return;
            startTxt.alpha = pulseMin + pulseRange * ((Math.sin(performance.now() / pulseSpeed) + 1) / 2);
            requestAnimationFrame(animate);
        };
        requestAnimationFrame(animate);

        return new Promise<void>((resolve) => {
            const onStart = () => {
                startLayer.destroy({ children: true });
                this.engine.scenes.jumpToScene(startScene);
                this.engine.start();
                resolve();
            };

            startLayer.on('pointerdown', onStart);

            const onKeyStart = () => {
                this.engine.events.off('input:start', onKeyStart);
                onStart();
            };
            this.engine.events.on('input:start', onKeyStart);
        });
    }
}