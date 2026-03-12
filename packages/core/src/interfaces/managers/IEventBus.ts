import type { SaveState } from '../../managers/SaveManager';
import type { Serializable } from '../../types';
import type { IBaseManager } from './IBaseManager';

export interface EngineEventMap {
    'flow:command': [sceneName: string, index: number];
    'flow:paused': [sceneName: string, index: number];
    'flow:resumed': [sceneName: string, index: number];
    'flow:stepped': [sceneName: string, index: number];
    'input:back': [];
    'input:confirm': [];
    'input:load': [slot: number];
    'input:navigate': [NavigationDirection];
    'input:next': [];
    'input:save': [slot: number];
    'input:skip': [];
    'input:start': [];
    'menu:toggle': [];
    'scene:loaded': [sceneName: string];
    'scene:loading': [sceneName: string];
    'state:loaded': [saveData: SaveState];
    'state:persistent_changed': [persistentState: Record<string, Serializable>];
}

export interface IEventBus extends IBaseManager {
    destroy(): void;
    emit<K extends keyof EngineEventMap>(event: K, ...arguments_: EngineEventMap[K]): void;
    off<K extends keyof EngineEventMap>(event: K, listener: (...arguments_: EngineEventMap[K]) => void): void;
    on<K extends keyof EngineEventMap>(event: K, listener: (...arguments_: EngineEventMap[K]) => void): void;
    once<K extends keyof EngineEventMap>(event: K, listener: (...arguments_: EngineEventMap[K]) => void): void;
}

export type NavigationDirection = 'down' | 'left' | 'right' | 'up';


