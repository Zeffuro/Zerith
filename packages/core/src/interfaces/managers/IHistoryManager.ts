import type { HistoryEntry } from '../../managers/HistoryManager';
import type { IBaseManager } from './IBaseManager';

export interface IHistoryManager extends IBaseManager {
    clear(): void;
    getAll(): readonly HistoryEntry[];
    getRecent(count: number): HistoryEntry[];
    readonly length: number;
    push(speaker: string, text: string): void;
}

