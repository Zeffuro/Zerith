import type { IBaseManager } from './IBaseManager';

export interface IAnimationManager extends IBaseManager {
    clear(): void;
    killTweensOf(target: unknown): void;
    set(target: unknown, vars: unknown): void;
    timeline(): unknown;
    to(target: unknown, vars: unknown): Promise<void>;
}

