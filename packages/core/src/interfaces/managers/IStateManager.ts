import type { Serializable, SystemState } from '../../types';
import type { IBaseManager } from './IBaseManager';

export interface IStateManager extends IBaseManager {
    clear(): void;
    get<T = Serializable>(key: string): T | undefined;
    getPersistent<T = Serializable>(key: string): T | undefined;
    get persistentState(): Record<string, Serializable>;
    replaceState(state: Record<string, Serializable>, system?: SystemState): void;
    set(key: string, value: unknown): void;
    setPersistent(key: string, value: unknown): void;
    get state(): Record<string, Serializable>;
    get system(): SystemState;
}

