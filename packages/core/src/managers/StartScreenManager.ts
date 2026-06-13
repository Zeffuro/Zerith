import { Container, Graphics, Text, type TextStyleFontWeight } from 'pixi.js';

import type { IDisplayManager, IEventBus, ISceneManager } from '../interfaces/managers';

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

export interface StartScreenDeps {
    display: Pick<IDisplayManager, 'height' | 'width'>;
    events: Pick<IEventBus, 'off' | 'on'>;
    overlayLayer: Container;
    scenes: Pick<ISceneManager, 'jumpToScene'>;
}

export class StartScreenManager {
    private readonly config: Required<StartScreenConfig>;
    private readonly deps: StartScreenDeps;
    private onKeyStart: (() => void) | undefined;

    constructor(deps: StartScreenDeps, config: StartScreenConfig = {}) {
        this.deps = deps;
        this.config = {
            backgroundAlpha: 0.85,
            backgroundColor: 0x00_00_00,
            fontFamily: 'Arial',
            fontSize: 36,
            fontWeight: 'bold',
            pulseMax: 1,
            pulseMin: 0.6,
            pulseSpeed: 500,
            text: 'CLICK TO START',
            textColor: 0xFF_FF_FF,
            ...config
        };
    }

    public destroy(): void {
        if (this.onKeyStart) {
            this.deps.events.off('input:start', this.onKeyStart);
            this.onKeyStart = undefined;
        }
    }

    /**
     * Shows a "click to start" overlay, waits for user interaction,
     * then jumps to the given scene.
     * Browsers require a user gesture before playing audio,
     * so this should be the standard entry point.
     */
    public show(startScene: string): Promise<void> {
        const { display, events, overlayLayer, scenes } = this.deps;
        this.destroy();
        const w = display.width;
        const h = display.height;
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
        overlayLayer.addChild(startLayer);

        const { pulseMax, pulseMin, pulseSpeed } = cfg;
        const pulseRange = pulseMax - pulseMin;
        const animate = () => {
            if (startLayer.destroyed) return;
            startTxt.alpha = pulseMin + pulseRange * ((Math.sin(performance.now() / pulseSpeed) + 1) / 2);
            requestAnimationFrame(animate);
        };
        requestAnimationFrame(animate);

        return new Promise<void>((resolve) => {
            const startGame = () => {
                if (this.onKeyStart) {
                    events.off('input:start', this.onKeyStart);
                    this.onKeyStart = undefined;
                }
                startLayer.destroy({ children: true });
                void scenes.jumpToScene(startScene).then(() => {
                    resolve();
                });
            };

            startLayer.on('pointerdown', startGame);

            this.onKeyStart = () => {
                startGame();
            };
            events.on('input:start', this.onKeyStart);
        });
    }

}