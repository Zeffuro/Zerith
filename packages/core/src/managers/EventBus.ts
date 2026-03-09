import type { EngineEventMap } from '../interfaces/managers';

type Listener = (...arguments_: unknown[]) => void;

export class EventBus {
    private listeners: Map<string, Set<Listener>> = new Map();

    public emit<K extends keyof EngineEventMap>(event: K, ...arguments_: EngineEventMap[K]): void;
    public emit(event: string, ...arguments_: unknown[]): void;
    public emit(event: string, ...arguments_: unknown[]) {
        const listeners = this.listeners.get(event);
        if (listeners) {
            for (const listener of listeners) {
                listener(...arguments_);
            }
        }
    }

    public off<K extends keyof EngineEventMap>(event: K, listener: (...arguments_: EngineEventMap[K]) => void): void;
    public off(event: string, listener: Listener): void;
    public off(event: string, listener: Listener) {
        this.listeners.get(event)?.delete(listener);
    }

    public on<K extends keyof EngineEventMap>(event: K, listener: (...arguments_: EngineEventMap[K]) => void): void;
    public on(event: string, listener: Listener): void;
    public on(event: string, listener: Listener) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event)!.add(listener);
    }

    public once<K extends keyof EngineEventMap>(event: K, listener: (...arguments_: EngineEventMap[K]) => void): void;
    public once(event: string, listener: Listener): void;
    public once(event: string, listener: Listener) {
        const wrapper = (...arguments_: unknown[]) => {
            listener(...arguments_);
            this.off(event, wrapper);
        };
        this.on(event, wrapper);
    }
}