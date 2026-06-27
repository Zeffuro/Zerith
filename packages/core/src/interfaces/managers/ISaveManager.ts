import type { SaveMeta, SaveOptions, SaveState } from '../../managers/SaveManager';
import type { IBaseManager } from './IBaseManager';

export interface ISaveManager extends IBaseManager {
    deleteSlot(slot: number): void;
    getMeta(slot: number): SaveMeta | undefined;
    hasSlot(slot: number): boolean;
    listSlots(maxSlots?: number): (SaveMeta | undefined)[];
    load(slot?: number): Promise<SaveState | undefined>;
    save(slot?: number, labelOrOptions?: SaveOptions | string): void;
}

