export interface ItemDefinition {
    [key: string]: unknown;
    description: string;
    id: string;
    imageUrl?: string;
    name: string;
}

export class ItemManager<T extends ItemDefinition = ItemDefinition> {
    protected definitions: Map<string, T> = new Map();
    protected items: Map<string, T> = new Map();

    public add(id: string): boolean {
        const definition = this.definitions.get(id);
        if (!definition) {
            console.warn(`[ItemManager] Unknown item id: '${id}'`);
            return false;
        }
        this.items.set(id, { ...definition });
        return true;
    }

    public clear() {
        this.items.clear();
    }

    public deserialize(ids: string[]) {
        this.items.clear();
        for (const id of ids) this.add(id);
    }

    public get(id: string): T | undefined {
        return this.items.get(id);
    }

    public getAll(): T[] {
        return [...this.items.values()];
    }

    public has(id: string): boolean {
        return this.items.has(id);
    }

    public loadDefinitions(defs: Record<string, Omit<T, 'id'>>) {
        this.definitions.clear();
        for (const [id, definition] of Object.entries(defs)) {
            this.definitions.set(id, { ...definition, id } as T);
        }
    }

    public remove(id: string): boolean {
        return this.items.delete(id);
    }

    public serialize(): string[] {
        return [...this.items.keys()];
    }

    public update(id: string, changes: Partial<Omit<T, 'id'>>) {
        const item = this.items.get(id);
        if (item) {
            Object.assign(item, changes);
        }
    }
}