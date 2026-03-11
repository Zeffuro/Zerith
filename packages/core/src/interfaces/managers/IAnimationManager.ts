import type { IBaseManager } from './IBaseManager';

export interface IAnimationManager extends IBaseManager {
    clear(): void;
    killTweensOf(target: unknown): void;
    set(target: unknown, variables: unknown): void;
    timeline(): unknown;
    to(target: unknown, variables: unknown): Promise<void>;
}

