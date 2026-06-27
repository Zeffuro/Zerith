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

    public deserialize(entries: readonly HistoryEntry[]): void {
        this.entries = entries
            .map((entry) => normalizeHistoryEntry(entry))
            .filter((entry): entry is HistoryEntry => entry !== undefined)
            .slice(-this._maxEntries);
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

    public serialize(): HistoryEntry[] {
        return this.entries.map((entry) => ({ ...entry }));
    }
}

function normalizeHistoryEntry(entry: HistoryEntry): HistoryEntry | undefined {
    if (
        typeof entry.speaker !== 'string'
        || typeof entry.text !== 'string'
        || typeof entry.timestamp !== 'number'
        || !Number.isFinite(entry.timestamp)
    ) {
        return undefined;
    }

    return {
        speaker: entry.speaker,
        text: entry.text,
        timestamp: entry.timestamp,
    };
}
