export interface ItemDefinition {
    id: string;
    name: string;
    description: string;
    imageUrl?: string;
    [key: string]: any;
}

export class ItemManager<T extends ItemDefinition = ItemDefinition> {
    protected definitions: Map<string, T> = new Map();
    protected items: Map<string, T> = new Map();

    public loadDefinitions(defs: Record<string, Omit<T, 'id'>>) {
        this.definitions.clear();
        for (const [id, def] of Object.entries(defs)) {
            this.definitions.set(id, { ...def, id } as T);
        }
    }

    public add(id: string): boolean {
        const def = this.definitions.get(id);
        if (!def) {
            console.warn(`[ItemManager] Unknown item id: '${id}'`);
            return false;
        }
        this.items.set(id, { ...def });
        return true;
    }

    public remove(id: string): boolean {
        return this.items.delete(id);
    }

    public has(id: string): boolean {
        return this.items.has(id);
    }

    public get(id: string): T | undefined {
        return this.items.get(id);
    }

    public getAll(): T[] {
        return [...this.items.values()];
    }

    public update(id: string, changes: Partial<Omit<T, 'id'>>) {
        const item = this.items.get(id);
        if (item) {
            Object.assign(item, changes);
        }
    }

    public clear() {
        this.items.clear();
    }

    public serialize(): string[] {
        return [...this.items.keys()];
    }

    public deserialize(ids: string[]) {
        this.items.clear();
        ids.forEach(id => this.add(id));
    }
}