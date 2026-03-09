import type { IBaseManager } from './IBaseManager';

export interface INotificationManager extends IBaseManager {
    show(message: string): void;
}

