import type { Container } from 'pixi.js';

import type { IBaseManager } from './IBaseManager';

export type DisplayLayerName = 'background' | 'overlay' | 'sprites' | 'ui';

export interface IDisplayManager extends IBaseManager {
    canvas: HTMLCanvasElement | undefined;
    clearLayers?(): void;
    getLayer(name: DisplayLayerName): Container;
    readonly height: number;
    init(canvas: HTMLCanvasElement): Promise<void>;
    readonly width: number;
}

