type Listener = (...args: any[]) => void;

export class EventBus {
    private listeners: Map<string, Set<Listener>> = new Map();

    public on(event: string, listener: Listener) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event)!.add(listener);
    }

    public off(event: string, listener: Listener) {
        this.listeners.get(event)?.delete(listener);
    }

    public once(event: string, listener: Listener) {
        const wrapper = (...args: any[]) => {
            listener(...args);
            this.off(event, wrapper);
        };
        this.on(event, wrapper);
    }

    public emit(event: string, ...args: any[]) {
        this.listeners.get(event)?.forEach(fn => fn(...args));
    }
}