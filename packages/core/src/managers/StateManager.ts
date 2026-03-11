import type { IEventBus, IStateManager } from '../interfaces/managers';
import type { Serializable, SystemState } from '../types';

import { createDefaultSystemState } from '../types';
import { deepClone } from '../utils/deepClone';

export class StateManager implements IStateManager {
    public get persistentState(): Record<string, Serializable> {
        return this._persistentState;
    }

    public get state(): Record<string, Serializable> {
        return this._state;
    }

    public get system(): SystemState {
        return this._system;
    }

    private _persistentState: Record<string, Serializable> = {};
    private _state: Record<string, Serializable> = {};
    private _system: SystemState = createDefaultSystemState();
    private readonly events: IEventBus;

    constructor(events: IEventBus) {
        this.events = events;
    }

    public clear(): void {
        this._state = {};
        this._system = createDefaultSystemState();
    }

    public get<T = Serializable>(key: string): T | undefined {
        return this._state[key] as T | undefined;
    }

    public getPersistent<T = Serializable>(key: string): T | undefined {
        return this._persistentState[key] as T | undefined;
    }

    public loadPersistentState(state: Record<string, Serializable>): void {
        this._persistentState = deepClone(state);
    }

    public replaceState(state: Record<string, Serializable>, system?: SystemState): void {
        this._state = deepClone(state);
        this._system = system
            ? deepClone(system)
            : createDefaultSystemState();

        this._system.sprites ??= {};
        this._system.items ??= [];
    }

    public set(key: string, value: unknown): void {
        const serializable = this.toSerializable(value);
        if (serializable === undefined) {
            delete this._state[key];
            return;
        }

        this._state[key] = serializable;
    }

    public setPersistent(key: string, value: unknown): void {
        const serializable = this.toSerializable(value);
        if (serializable === undefined) {
            delete this._persistentState[key];
            this.events.emit('state:persistent_changed', this._persistentState);
            return;
        }

        this._persistentState[key] = serializable;
        this.events.emit('state:persistent_changed', this._persistentState);
    }

    private isRecord(value: unknown): value is Record<string, unknown> {
        return typeof value === 'object' && value !== null;
    }

    private toSerializable(value: unknown): Serializable | undefined {
        if (value === undefined) return undefined;
        if (value === null) return value;

        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
            return value;
        }

        if (Array.isArray(value)) {
            return value
                .map((item) => this.toSerializable(item))
                .filter((item): item is Serializable => item !== undefined);
        }

        if (this.isRecord(value)) {
            const serializableObject: Record<string, Serializable> = {};
            for (const [key, item] of Object.entries(value)) {
                const serializableItem = this.toSerializable(item);
                if (serializableItem === undefined) continue;
                serializableObject[key] = serializableItem;
            }
            return serializableObject;
        }

        return undefined;
    }
}

