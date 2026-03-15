import type { EvidenceItem, Serializable } from 'core';

export type DraftValueKind = 'boolean' | 'json' | 'null' | 'number' | 'string';

export type ItemDraftRow = {
    customJson: string;
    description: string;
    id: string;
    imageUrl: string;
    itemId: string;
    name: string;
    type: string;
};

export type ObserverSnapshot = {
    items: EvidenceItem[];
    state: Record<string, Serializable>;
};

export type StateDraftRow = {
    id: string;
    key: string;
    valueText: string;
};

export const EMPTY_SNAPSHOT: ObserverSnapshot = {
    items: [],
    state: {},
};

export function defaultValueForKind(kind: DraftValueKind): string {
    switch (kind) {
        case 'boolean': {
            return 'false';
        }
        case 'json': {
            return '{}';
        }
        case 'null': {
            return 'null';
        }
        case 'number': {
            return '0';
        }
        case 'string': {
            return '""';
        }
    }
}

export function detectDraftValueKind(valueText: string): DraftValueKind {
    const parsed = parseDraftUnknown(valueText);
    if (parsed === undefined) return 'json';
    if (parsed === null) return 'null';
    if (typeof parsed === 'boolean') return 'boolean';
    if (typeof parsed === 'number') return 'number';
    if (typeof parsed === 'string') return 'string';
    return 'json';
}

export function parseDraftObject(raw: string): Record<string, unknown> | undefined {
    const parsed = parseDraftUnknown(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return undefined;
    }
    return parsed as Record<string, unknown>;
}

export function parseDraftValue(raw: string): Serializable | undefined {
    const parsed = parseDraftUnknown(raw);
    return isSerializable(parsed) ? parsed : undefined;
}

export function safeStringValue(valueText: string): string {
    const parsed = parseDraftUnknown(valueText);
    return typeof parsed === 'string' ? parsed : '';
}

export function snapshotSignature(snapshot: ObserverSnapshot): string {
    return JSON.stringify(snapshot);
}

export function toItemDraftRow(item: EvidenceItem, rowId: string): ItemDraftRow {
    const { description, id, imageUrl, name, type, ...custom } = item;
    return {
        customJson: JSON.stringify(custom, undefined, 0),
        description,
        id: rowId,
        imageUrl: typeof imageUrl === 'string' ? imageUrl : '',
        itemId: id,
        name,
        type: type === 'profile' ? 'profile' : 'evidence',
    };
}

export function toItemPayload(row: ItemDraftRow): Partial<Omit<EvidenceItem, 'id'>> | undefined {
    const custom = parseDraftObject(row.customJson);
    if (!custom) {
        return undefined;
    }

    return {
        ...custom,
        description: row.description,
        imageUrl: row.imageUrl.trim() || undefined,
        name: row.name,
        type: row.type === 'profile' ? 'profile' : 'evidence',
    };
}

function isSerializable(value: unknown): value is Serializable {
    if (value === null) return true;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return true;
    if (Array.isArray(value)) return value.every((entry) => isSerializable(entry));
    if (typeof value === 'object') {
        return Object.values(value as Record<string, unknown>).every((entry) => isSerializable(entry));
    }
    return false;
}

function parseDraftUnknown(raw: string): unknown {
    try {
        return JSON.parse(raw);
    } catch {
        return undefined;
    }
}

