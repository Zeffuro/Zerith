import type { IBaseManager } from './IBaseManager';

type Listener = (...arguments_: unknown[]) => void;

export type NavigationDirection = 'down' | 'left' | 'right' | 'up';

export interface EngineEventMap {
    'input:back': [];
    'input:confirm': [];
    'input:navigate': [NavigationDirection];
    'input:next': [];
    'input:start': [];
    'menu:toggle': [];
    'scene:loaded': [string];
    'scene:loading': [string];
    'script:command_executed': [string];
}

export interface IEventBus extends IBaseManager {
    emit<K extends keyof EngineEventMap>(event: K, ...arguments_: EngineEventMap[K]): void;
    emit(event: string, ...arguments_: unknown[]): void;
    off<K extends keyof EngineEventMap>(event: K, listener: (...arguments_: EngineEventMap[K]) => void): void;
    off(event: string, listener: Listener): void;
    on<K extends keyof EngineEventMap>(event: K, listener: (...arguments_: EngineEventMap[K]) => void): void;
    on(event: string, listener: Listener): void;
    once<K extends keyof EngineEventMap>(event: K, listener: (...arguments_: EngineEventMap[K]) => void): void;
    once(event: string, listener: Listener): void;
}

