import type { SaveMeta } from '../../managers/SaveManager';
import type { IBaseManager } from './IBaseManager';

export interface ISaveManager extends IBaseManager {
    deleteSlot(slot: number): void;
    getMeta(slot: number): SaveMeta | undefined;
    hasSlot(slot: number): boolean;
    listSlots(maxSlots?: number): (SaveMeta | undefined)[];
    load(slot?: number): Promise<void>;
    save(slot?: number, label?: string): void;
}

