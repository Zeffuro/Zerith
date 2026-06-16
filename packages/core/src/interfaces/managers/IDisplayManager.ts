import type { Container } from 'pixi.js';

import type { IBaseManager } from './IBaseManager';

export const BUILT_IN_DISPLAY_LAYERS = [
    'background',
    'backgroundEffects',
    'sprites',
    'foregroundEffects',
    'ui',
    'overlay',
] as const;

export type BuiltInDisplayLayerName = typeof BUILT_IN_DISPLAY_LAYERS[number];
export type DisplayLayerName = ({} & string) | BuiltInDisplayLayerName;

export interface IDisplayManager extends IBaseManager {
    canvas: HTMLCanvasElement | undefined;
    clearLayers?(): void;
    getLayer(name: DisplayLayerName): Container;
    readonly height: number;
    init(canvas: HTMLCanvasElement): Promise<void>;
    readonly width: number;
}

