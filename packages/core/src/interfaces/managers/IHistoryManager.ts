import type { HistoryEntry } from '../../managers/HistoryManager';
import type { IBaseManager } from './IBaseManager';

export interface IHistoryManager extends IBaseManager {
    readonly length: number;
    clear(): void;
    getAll(): readonly HistoryEntry[];
    getRecent(count: number): HistoryEntry[];
    push(speaker: string, text: string): void;
}

