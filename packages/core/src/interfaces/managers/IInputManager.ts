import type { IBaseManager } from './IBaseManager';

export interface IInputManager extends IBaseManager {
    attach(canvas: HTMLCanvasElement): void;
    detach(): void;
}

