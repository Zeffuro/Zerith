export interface HistoryEntry {
    speaker: string;
    text: string;
    timestamp: number;
}

export class HistoryManager {
    private entries: HistoryEntry[] = [];
    private _maxEntries: number;

    constructor(maxEntries: number = 200) {
        this._maxEntries = maxEntries;
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

    public getAll(): readonly HistoryEntry[] {
        return this.entries;
    }

    public getRecent(count: number): HistoryEntry[] {
        return this.entries.slice(-count);
    }

    public get length(): number {
        return this.entries.length;
    }

    public clear() {
        this.entries = [];
    }
}