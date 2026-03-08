type Listener = (...arguments_: any[]) => void;

export class EventBus {
    private listeners: Map<string, Set<Listener>> = new Map();

    public emit(event: string, ...arguments_: any[]) {
        this.listeners.get(event)?.forEach(function_ => function_(...arguments_));
    }

    public off(event: string, listener: Listener) {
        this.listeners.get(event)?.delete(listener);
    }

    public on(event: string, listener: Listener) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event)!.add(listener);
    }

    public once(event: string, listener: Listener) {
        const wrapper = (...arguments_: any[]) => {
            listener(...arguments_);
            this.off(event, wrapper);
        };
        this.on(event, wrapper);
    }
}