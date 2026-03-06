import type { Application } from 'pixi.js';

export interface DisplayConfig {
    width: number;
    height: number;
    scaleMode: 'fixed' | 'fit' | 'fill' | 'stretch';
    backgroundColor: number;
}

export const DefaultDisplayConfig: DisplayConfig = {
    width: 800,
    height: 600,
    scaleMode: 'fit',
    backgroundColor: 0x111111
};

export class DisplayManager {
    private app: Application;
    public canvas: HTMLCanvasElement | null = null;
    private config: DisplayConfig;
    private resizeObserver: ResizeObserver | null = null;
    private boundApplyScale: (() => void) | null = null;

    public get width(): number { return this.config.width; }
    public get height(): number { return this.config.height; }

    constructor(app: Application, config: Partial<DisplayConfig> = {}) {
        this.app = app;
        this.config = { ...DefaultDisplayConfig, ...config };
    }

    public async init(canvas: HTMLCanvasElement) {
        this.canvas = canvas;

        await this.app.init({
            canvas,
            width: this.config.width,
            height: this.config.height,
            backgroundColor: this.config.backgroundColor,
            autoDensity: true,
            resolution: window.devicePixelRatio || 1
        });

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
            case 'fit':
                if (parentAspect > gameAspect) {
                    cssHeight = parentH;
                    cssWidth = parentH * gameAspect;
                } else {
                    cssWidth = parentW;
                    cssHeight = parentW / gameAspect;
                }
                break;

            case 'fill':
                if (parentAspect > gameAspect) {
                    cssWidth = parentW;
                    cssHeight = parentW / gameAspect;
                } else {
                    cssHeight = parentH;
                    cssWidth = parentH * gameAspect;
                }
                break;

            case 'stretch':
                cssWidth = parentW;
                cssHeight = parentH;
                break;

            default:
                return;
        }

        this.canvas.style.width = `${cssWidth}px`;
        this.canvas.style.height = `${cssHeight}px`;

        this.canvas.style.position = 'absolute';
        this.canvas.style.left = `${(parentW - cssWidth) / 2}px`;
        this.canvas.style.top = `${(parentH - cssHeight) / 2}px`;
    }

    public destroy() {
        if (this.boundApplyScale) {
            window.removeEventListener('resize', this.boundApplyScale);
        }
        this.resizeObserver?.disconnect();
        this.resizeObserver = null;
        this.boundApplyScale = null;
    }
}