import { Application, Container } from 'pixi.js';

import type { DisplayLayerName } from '../interfaces/managers';

export interface DisplayConfig {
    backgroundColor: number;
    height: number;
    layers?: DisplayLayerDefinition[];
    scaleMode: 'fill' | 'fit' | 'fixed' | 'stretch';
    width: number;
}

export interface DisplayLayerDefinition {
    id: string;
    order?: number;
}

const DEFAULT_DYNAMIC_LAYER_ORDER = 350;
const SAVE_THUMBNAIL_HEIGHT = 108;
const SAVE_THUMBNAIL_WIDTH = 192;
const DEFAULT_LAYER_DEFINITIONS: Required<DisplayLayerDefinition>[] = [
    { id: 'background', order: 0 },
    { id: 'backgroundEffects', order: 100 },
    { id: 'sprites', order: 200 },
    { id: 'foregroundEffects', order: 300 },
    { id: 'ui', order: 400 },
    { id: 'overlay', order: 500 },
];

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
    private readonly layerDefinitions = new Map<string, number>();
    private readonly layers = new Map<string, Container>();

    private resizeObserver: ResizeObserver | undefined;

    constructor(config: Partial<DisplayConfig> = {}) {
        this.app = new Application();
        this.config = { ...DefaultDisplayConfig, ...config };
        this.configureLayers(this.config.layers);
    }

    public captureThumbnailDataUrl(): string | undefined {
        if (!this.canvas) return undefined;

        const overlayLayer = this.layers.get('overlay');
        const previousOverlayVisible = overlayLayer?.visible;

        try {
            if (overlayLayer) {
                overlayLayer.visible = false;
            }

            this.app.render();
            return createCanvasThumbnailDataUrl(this.canvas);
        } catch {
            return undefined;
        } finally {
            if (overlayLayer && previousOverlayVisible !== undefined) {
                overlayLayer.visible = previousOverlayVisible;
            }

            if (this.canvas) {
                this.app.render();
            }
        }
    }

    public clearLayers() {
        for (const layer of this.layers.values()) {
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
        const id = String(name);
        let layer = this.layers.get(id);
        if (layer) return layer;

        layer = new Container();
        this.layers.set(id, layer);
        this.layerDefinitions.set(id, DEFAULT_DYNAMIC_LAYER_ORDER);

        if (this.canvas) {
            this.app.stage.addChildAt(layer, this.getLayerInsertionIndex(id));
        }

        return layer;
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

        for (const id of this.getOrderedLayerIds()) {
            this.app.stage.addChild(this.getLayer(id));
        }

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

    private configureLayers(configuredLayers: DisplayLayerDefinition[] | undefined): void {
        this.layerDefinitions.clear();

        for (const layer of DEFAULT_LAYER_DEFINITIONS) {
            this.layerDefinitions.set(layer.id, layer.order);
            this.layers.set(layer.id, this.layers.get(layer.id) ?? new Container());
        }

        for (const layer of configuredLayers ?? []) {
            const id = layer.id.trim();
            if (id.length === 0) continue;
            const order = typeof layer.order === 'number' && Number.isFinite(layer.order)
                ? layer.order
                : DEFAULT_DYNAMIC_LAYER_ORDER;

            this.layerDefinitions.set(id, order);
            this.layers.set(id, this.layers.get(id) ?? new Container());
        }
    }

    private getLayerInsertionIndex(id: string): number {
        const ids = this.getOrderedLayerIds();
        const targetIndex = ids.indexOf(id);
        if (targetIndex === -1) return this.app.stage.children.length;

        const earlierLayerIds = new Set(ids.slice(0, targetIndex));
        let insertionIndex = 0;

        for (const child of this.app.stage.children) {
            const childLayerId = findLayerIdByContainer(this.layers, child);
            if (childLayerId && earlierLayerIds.has(childLayerId)) {
                insertionIndex += 1;
            }
        }

        return insertionIndex;
    }

    private getOrderedLayerIds(): string[] {
        return [...this.layerDefinitions.entries()]
            .toSorted(([idA, orderA], [idB, orderB]) => orderA - orderB || idA.localeCompare(idB))
            .map(([id]) => id);
    }
}

function createCanvasThumbnailDataUrl(source: HTMLCanvasElement): string | undefined {
    if (source.width <= 0 || source.height <= 0) return undefined;

    const canvas = source.ownerDocument.createElement('canvas');
    canvas.width = SAVE_THUMBNAIL_WIDTH;
    canvas.height = SAVE_THUMBNAIL_HEIGHT;

    const context = canvas.getContext('2d');
    if (!context) return undefined;

    context.fillStyle = '#000000';
    context.fillRect(0, 0, SAVE_THUMBNAIL_WIDTH, SAVE_THUMBNAIL_HEIGHT);

    const scale = Math.min(SAVE_THUMBNAIL_WIDTH / source.width, SAVE_THUMBNAIL_HEIGHT / source.height);
    const drawWidth = Math.max(1, Math.round(source.width * scale));
    const drawHeight = Math.max(1, Math.round(source.height * scale));
    const x = Math.round((SAVE_THUMBNAIL_WIDTH - drawWidth) / 2);
    const y = Math.round((SAVE_THUMBNAIL_HEIGHT - drawHeight) / 2);

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(source, 0, 0, source.width, source.height, x, y, drawWidth, drawHeight);

    return canvas.toDataURL('image/webp', 0.75);
}

function findLayerIdByContainer(layers: ReadonlyMap<string, Container>, container: Container): string | undefined {
    for (const [id, layer] of layers) {
        if (layer === container) return id;
    }
}
