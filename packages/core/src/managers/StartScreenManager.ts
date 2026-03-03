import { Container, Graphics, Text, type TextStyleFontWeight } from 'pixi.js';
import type { Engine } from '../Engine';

export interface StartScreenConfig {
    text?: string;
    fontSize?: number;
    fontFamily?: string;
    fontWeight?: TextStyleFontWeight;
    textColor?: number;
    backgroundColor?: number;
    backgroundAlpha?: number;
    pulseSpeed?: number;
    pulseMin?: number;
    pulseMax?: number;
}

export class StartScreenManager {
    private engine: Engine;
    private readonly config: Required<StartScreenConfig>;

    constructor(engine: Engine, config: StartScreenConfig = {}) {
        this.engine = engine;
        this.config = {
            text: 'CLICK TO START',
            fontSize: 36,
            fontFamily: 'Arial',
            fontWeight: 'bold' as TextStyleFontWeight,
            textColor: 0xffffff,
            backgroundColor: 0x000000,
            backgroundAlpha: 0.85,
            pulseSpeed: 500,
            pulseMin: 0.6,
            pulseMax: 1.0,
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
            .fill({ color: cfg.backgroundColor, alpha: cfg.backgroundAlpha });

        const startTxt = new Text({
            text: cfg.text,
            style: {
                fill: cfg.textColor,
                fontSize: cfg.fontSize,
                fontFamily: cfg.fontFamily,
                fontWeight: cfg.fontWeight
            }
        });
        startTxt.anchor.set(0.5);
        startTxt.position.set(w / 2, h / 2);

        startLayer.addChild(overlayBg, startTxt);
        startLayer.eventMode = 'static';
        startLayer.cursor = 'pointer';
        this.engine.layers.overlay.addChild(startLayer);

        const { pulseSpeed, pulseMin, pulseMax } = cfg;
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
                this.engine.jumpToScene(startScene);
                this.engine.start();
                resolve();
            };

            startLayer.on('pointerdown', onStart);

            const onKeyStart = () => {
                this.engine.off('input:start', onKeyStart);
                onStart();
            };
            this.engine.on('input:start', onKeyStart);
        });
    }
}