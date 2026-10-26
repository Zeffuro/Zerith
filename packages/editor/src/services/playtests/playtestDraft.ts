import type { PlaytestScenario } from './playtestModel';

export type PlaytestDraft = { choices: string; expectedScene: string; expectedState: string; id: string; index: number; inventory: string[]; locale: string; name: string; scene: string; state: string };
export type PlaytestDraftLease = { identity: number; lifetime: number; owner: symbol; revision: number };

export class PlaytestDraftController {
    value = blankDraft();
    private active = true;
    private identity = 0;
    private lifetime = 0;
    private readonly owner = Symbol('playtest draft');
    private revision = 0;

    activate(): void { this.active = true; }

    capture(): PlaytestDraftLease {
        return { identity: this.identity, lifetime: this.lifetime, owner: this.owner, revision: this.revision };
    }

    clear(): void {
        this.identity++;
        this.revision++;
        this.value = blankDraft();
    }

    completeDelete(lease: PlaytestDraftLease): boolean {
        if (!this.owns(lease)) return false;
        this.clear();
        return true;
    }

    completeSave(lease: PlaytestDraftLease, scenario: PlaytestScenario): boolean {
        if (!this.ownsIdentity(lease)) return false;
        // The persisted ID belongs to this draft even when newer fields remain unsaved.
        this.value = this.owns(lease) ? scenarioDraft(scenario) : { ...this.value, id: scenario.id };
        return true;
    }

    edit(patch: Partial<PlaytestDraft>): void {
        this.revision++;
        this.value = { ...this.value, ...patch };
    }

    isActive(lease: PlaytestDraftLease): boolean {
        return this.active && this.owner === lease.owner && this.lifetime === lease.lifetime;
    }

    owns(lease: PlaytestDraftLease): boolean {
        return this.ownsIdentity(lease) && this.revision === lease.revision;
    }

    retire(): void {
        this.active = false;
        this.lifetime++;
    }

    select(scenario: PlaytestScenario): void {
        this.identity++;
        this.revision++;
        this.value = scenarioDraft(scenario);
    }

    private ownsIdentity(lease: PlaytestDraftLease): boolean {
        return this.isActive(lease) && this.identity === lease.identity;
    }
}

function blankDraft(): PlaytestDraft {
    return { choices: '[]', expectedScene: '', expectedState: '{}', id: '', index: 1, inventory: [], locale: '', name: '', scene: '', state: '{}' };
}

function scenarioDraft(value: PlaytestScenario): PlaytestDraft {
    return { choices: JSON.stringify(value.choices), expectedScene: value.expectedScene ?? '', expectedState: JSON.stringify(value.expectedState, undefined, 2), id: value.id, index: value.index + 1, inventory: value.inventory, locale: value.locale ?? '', name: value.name, scene: value.scene, state: JSON.stringify(value.state, undefined, 2) };
}
