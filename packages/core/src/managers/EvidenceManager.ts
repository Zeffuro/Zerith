import { type ItemDefinition, ItemManager } from './ItemManager';

export interface EvidenceItem extends ItemDefinition {
    type: 'evidence' | 'profile';
}

export class EvidenceManager extends ItemManager<EvidenceItem> {
    public getEvidence(): EvidenceItem[] {
        return this.getAll().filter(e => e.type === 'evidence');
    }

    public getProfiles(): EvidenceItem[] {
        return this.getAll().filter(e => e.type === 'profile');
    }
}