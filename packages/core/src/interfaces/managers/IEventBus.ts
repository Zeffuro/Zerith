import type { SaveState } from '../../managers/SaveManager';
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
    'script:command_executed': [string];
    'state:loaded': [SaveState];
}

export interface IEventBus extends IBaseManager {
    emit<K extends keyof EngineEventMap>(event: K, ...arguments_: EngineEventMap[K]): void;
    off<K extends keyof EngineEventMap>(event: K, listener: (...arguments_: EngineEventMap[K]) => void): void;
    on<K extends keyof EngineEventMap>(event: K, listener: (...arguments_: EngineEventMap[K]) => void): void;
    once<K extends keyof EngineEventMap>(event: K, listener: (...arguments_: EngineEventMap[K]) => void): void;
}

export type NavigationDirection = 'down' | 'left' | 'right' | 'up';


