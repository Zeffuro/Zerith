import type { IBaseManager } from './IBaseManager';

export interface IStartScreenManager extends IBaseManager {
    show(startScene: string): Promise<void>;
}

