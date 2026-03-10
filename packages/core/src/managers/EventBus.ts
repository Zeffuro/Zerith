import type { EngineEventMap } from '../interfaces/managers';

type AnyListener = (...arguments_: unknown[]) => void;
type EventName = keyof EngineEventMap;
type Listener<K extends EventName> = (...arguments_: EngineEventMap[K]) => void;

export class EventBus {
    private listeners: Map<EventName, Set<AnyListener>> = new Map();

    public emit<K extends EventName>(event: K, ...arguments_: EngineEventMap[K]) {
        const listeners = this.listeners.get(event) as Set<Listener<K>> | undefined;
        if (listeners) {
            for (const listener of listeners) {
                listener(...arguments_);
            }
        }
    }

    public off<K extends EventName>(event: K, listener: Listener<K>) {
        this.listeners.get(event)?.delete(listener as AnyListener);
    }

    public on<K extends EventName>(event: K, listener: Listener<K>) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event)!.add(listener as AnyListener);
    }

    public once<K extends EventName>(event: K, listener: Listener<K>) {
        const wrapper: Listener<K> = (...arguments_) => {
            listener(...arguments_);
            this.off(event, wrapper);
        };
        this.on(event, wrapper);
    }
}