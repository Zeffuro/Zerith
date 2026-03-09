import type { EvidenceItem } from '../../managers/EvidenceManager';
import type { IBaseManager } from './IBaseManager';

export interface IEvidenceManager extends IBaseManager {
    add(id: string): boolean;
    clear(): void;
    deserialize(ids: string[]): void;
    get(id: string): EvidenceItem | undefined;
    getAll(): EvidenceItem[];
    getEvidence(): EvidenceItem[];
    getProfiles(): EvidenceItem[];
    has(id: string): boolean;
    loadDefinitions(defs: Record<string, Omit<EvidenceItem, 'id'>>): void;
    remove(id: string): boolean;
    serialize(): string[];
    update(id: string, changes: Partial<Omit<EvidenceItem, 'id'>>): void;
}

