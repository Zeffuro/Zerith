import type { SaveState } from '../../managers/SaveManager';
import type { Serializable } from '../../types';
import type { IBaseManager } from './IBaseManager';

export interface EngineEventMap {
    'input:back': [];
    'input:confirm': [];
    'input:load': [number];
    'input:navigate': [NavigationDirection];
    'input:next': [];
    'input:save': [number];
    'input:skip': [];
    'input:start': [];
    'menu:toggle': [];
    'scene:loaded': [string];
    'scene:loading': [string];
    'state:loaded': [SaveState];
    'state:persistent_changed': [Record<string, Serializable>];
}

export interface IEventBus extends IBaseManager {
    destroy(): void;
    emit<K extends keyof EngineEventMap>(event: K, ...arguments_: EngineEventMap[K]): void;
    off<K extends keyof EngineEventMap>(event: K, listener: (...arguments_: EngineEventMap[K]) => void): void;
    on<K extends keyof EngineEventMap>(event: K, listener: (...arguments_: EngineEventMap[K]) => void): void;
    once<K extends keyof EngineEventMap>(event: K, listener: (...arguments_: EngineEventMap[K]) => void): void;
}

export type NavigationDirection = 'down' | 'left' | 'right' | 'up';


