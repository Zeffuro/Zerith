import type { IBaseManager } from './IBaseManager';

export interface IDisplayManager extends IBaseManager {
    canvas: HTMLCanvasElement | undefined;
    readonly height: number;
    readonly width: number;
    init(canvas: HTMLCanvasElement): Promise<void>;
}

