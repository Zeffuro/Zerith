export interface HistoryEntry {
    speaker: string;
    text: string;
    timestamp: number;
}

export class HistoryManager {
    public get length(): number {
        return this.entries.length;
    }
    private _maxEntries: number;

    private entries: HistoryEntry[] = [];

    constructor(maxEntries: number = 200) {
        this._maxEntries = maxEntries;
    }

    public clear() {
        this.entries = [];
    }

    public getAll(): readonly HistoryEntry[] {
        return this.entries;
    }

    public getRecent(count: number): HistoryEntry[] {
        return this.entries.slice(-count);
    }

    public push(speaker: string, text: string) {
        this.entries.push({
            speaker,
            text,
            timestamp: Date.now()
        });

        if (this.entries.length > this._maxEntries) {
            this.entries.shift();
        }
    }
}