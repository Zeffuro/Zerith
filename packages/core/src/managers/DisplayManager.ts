import { Application, Container } from 'pixi.js';

import type { DisplayLayerName } from '../interfaces/managers';

export interface DisplayConfig {
    backgroundColor: number;
    height: number;
    scaleMode: 'fill' | 'fit' | 'fixed' | 'stretch';
    width: number;
}

export const DefaultDisplayConfig: DisplayConfig = {
    backgroundColor: 0x11_11_11,
    height: 600,
    scaleMode: 'fit',
    width: 800
};

export class DisplayManager {
    public canvas: HTMLCanvasElement | undefined;
    public get height(): number { return this.config.height; }
    public get width(): number { return this.config.width; }
    private readonly app: Application;
    private boundApplyScale: (() => void) | undefined;

    private config: DisplayConfig;
    private readonly layers: Record<DisplayLayerName, Container> = {
        background: new Container(),
        overlay: new Container(),
        sprites: new Container(),
        ui: new Container(),
    };

    private resizeObserver: ResizeObserver | undefined;

    constructor(config: Partial<DisplayConfig> = {}) {
        this.app = new Application();
        this.config = { ...DefaultDisplayConfig, ...config };
    }

    public clearLayers() {
        for (const layer of Object.values(this.layers)) {
            for (const child of layer.removeChildren()) child.destroy({ children: true });
        }
    }

    public destroy() {
        if (this.boundApplyScale) {
            window.removeEventListener('resize', this.boundApplyScale);
        }
        this.resizeObserver?.disconnect();
        this.resizeObserver = undefined;
        this.boundApplyScale = undefined;
    }

    public getLayer(name: DisplayLayerName): Container {
        return this.layers[name];
    }

    public async init(canvas: HTMLCanvasElement) {
        this.canvas = canvas;

        await this.app.init({
            autoDensity: true,
            backgroundColor: this.config.backgroundColor,
            canvas,
            height: this.config.height,
            resolution: window.devicePixelRatio || 1,
            width: this.config.width
        });

        this.app.stage.addChild(
            this.layers.background,
            this.layers.sprites,
            this.layers.ui,
            this.layers.overlay
        );

        if (this.config.scaleMode !== 'fixed') {
            this.boundApplyScale = () => this.applyScale();
            this.applyScale();

            this.resizeObserver = new ResizeObserver(this.boundApplyScale);
            this.resizeObserver.observe(canvas.parentElement || document.body);
            window.addEventListener('resize', this.boundApplyScale);
        }
    }

    private applyScale() {
        if (!this.canvas) return;

        const parent = this.canvas.parentElement || document.body;
        const parentW = parent.clientWidth;
        const parentH = parent.clientHeight;

        const gameAspect = this.config.width / this.config.height;
        const parentAspect = parentW / parentH;

        let cssWidth: number;
        let cssHeight: number;

        switch (this.config.scaleMode) {
            case 'fill': {
                if (parentAspect > gameAspect) {
                    cssWidth = parentW;
                    cssHeight = parentW / gameAspect;
                } else {
                    cssHeight = parentH;
                    cssWidth = parentH * gameAspect;
                }
                break;
            }

            case 'fit': {
                if (parentAspect > gameAspect) {
                    cssHeight = parentH;
                    cssWidth = parentH * gameAspect;
                } else {
                    cssWidth = parentW;
                    cssHeight = parentW / gameAspect;
                }
                break;
            }

            case 'stretch': {
                cssWidth = parentW;
                cssHeight = parentH;
                break;
            }

            default: {
                return;
            }
        }

        this.canvas.style.width = `${cssWidth}px`;
        this.canvas.style.height = `${cssHeight}px`;

        this.canvas.style.position = 'absolute';
        this.canvas.style.left = `${(parentW - cssWidth) / 2}px`;
        this.canvas.style.top = `${(parentH - cssHeight) / 2}px`;
    }
}