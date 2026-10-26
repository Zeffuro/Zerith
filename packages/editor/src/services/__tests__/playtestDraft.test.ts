import { describe, expect, it } from 'vitest';

import type { PlaytestScenario } from '../playtests/playtestModel';

import { PlaytestDraftController } from '../playtests/playtestDraft';

const scenario: PlaytestScenario = { choices: [1], expectedState: {}, id: 'A', index: 0, inventory: ['ticket'], name: 'Original A', scene: 'station', state: { trust: 1 } };

function pendingDelete(controller: PlaytestDraftController) {
    const lease = controller.capture();
    let resolve!: (saved: boolean) => void;
    const completed = new Promise<boolean>(complete => { resolve = complete; }).then(saved => {
        if (saved) controller.completeDelete(lease);
    });
    return { completed, resolve };
}

function pendingSave(controller: PlaytestDraftController, value = scenario) {
    const lease = controller.capture();
    let resolve!: (saved: boolean) => void;
    const completed = new Promise<boolean>(complete => { resolve = complete; }).then(saved => {
        if (saved) controller.completeSave(lease, value);
        return saved;
    });
    return { completed, lease, resolve };
}

describe('playtest draft completion ownership', () => {
    it('preserves a newer edit while saving the captured scenario', async () => {
        const controller = new PlaytestDraftController();
        controller.select(scenario);
        const pending = pendingSave(controller);
        controller.edit({ name: 'New unsaved edit' });
        pending.resolve(true);
        await pending.completed;
        expect(controller.value.name).toBe('New unsaved edit');
        expect(controller.value.id).toBe('A');
        expect(controller.owns(pending.lease)).toBe(false);
        expect(scenario.name).toBe('Original A');
    });

    it.each([
        { index: 4, inventory: ['notebook'], locale: 'nl', scene: 'dock', state: '{"trust":9}' },
        { choices: '[0,2,1]' },
        { expectedScene: 'dock', expectedState: '{"trust":9}' },
    ])('retains preview, recorded choices and result-check captures during save', async patch => {
        const controller = new PlaytestDraftController();
        controller.select(scenario);
        const pending = pendingSave(controller);
        controller.edit(patch);
        pending.resolve(true);
        await pending.completed;
        expect(controller.value).toMatchObject(patch);
    });

    it('does not reselect A after switching to B during save', async () => {
        const controller = new PlaytestDraftController();
        controller.select(scenario);
        const pending = pendingSave(controller);
        controller.select({ ...scenario, id: 'B', name: 'Original B' });
        pending.resolve(true);
        await pending.completed;
        expect(controller.value).toMatchObject({ id: 'B', name: 'Original B' });
    });

    it('retires A even when the user selects A again before its save finishes', async () => {
        const controller = new PlaytestDraftController();
        controller.select(scenario);
        const pending = pendingSave(controller);
        controller.select({ ...scenario, id: 'B' });
        controller.select(scenario);
        controller.edit({ name: 'Successor A' });
        pending.resolve(true);
        await pending.completed;
        expect(controller.value.name).toBe('Successor A');
        expect(controller.owns(pending.lease)).toBe(false);
    });

    it('assigns a stable saved ID to a new draft while retaining mid-save edits', async () => {
        const controller = new PlaytestDraftController();
        controller.edit({ name: 'New scenario' });
        const pending = pendingSave(controller, { ...scenario, id: 'stable-new-id', name: 'New scenario' });
        controller.edit({ choices: '[0]', name: 'Edited new scenario' });
        pending.resolve(true);
        await pending.completed;
        expect(controller.value).toMatchObject({ choices: '[0]', id: 'stable-new-id', name: 'Edited new scenario' });
        const library = [{ ...scenario, id: 'stable-new-id', name: 'New scenario' }];
        const next = [...library.filter(value => value.id !== controller.value.id), { ...scenario, id: controller.value.id, name: controller.value.name }];
        expect(next).toHaveLength(1);
        expect(next[0].name).toBe('Edited new scenario');
    });

    it('normalizes an unchanged new draft after successful save', async () => {
        const controller = new PlaytestDraftController();
        controller.edit({ name: '  Original A  ' });
        const pending = pendingSave(controller);
        pending.resolve(true);
        await pending.completed;
        expect(controller.value).toMatchObject({ choices: '[1]', id: 'A', index: 1, name: 'Original A', state: '{\n  "trust": 1\n}' });
        expect(controller.owns(pending.lease)).toBe(true);
    });

    it('keeps edits and leaves new drafts without a persisted ID on failure', async () => {
        const controller = new PlaytestDraftController();
        controller.edit({ name: 'New draft' });
        const pending = pendingSave(controller);
        controller.edit({ name: 'Newer draft' });
        pending.resolve(false);
        await pending.completed;
        expect(controller.value).toMatchObject({ id: '', name: 'Newer draft' });
        expect(controller.owns(pending.lease)).toBe(false);
    });

    it('preserves newer edits during deletion', async () => {
        const controller = new PlaytestDraftController();
        controller.select(scenario);
        const pending = pendingDelete(controller);
        controller.edit({ name: 'Keep this draft' });
        pending.resolve(true);
        await pending.completed;
        expect(controller.value).toMatchObject({ id: 'A', name: 'Keep this draft' });
    });

    it('preserves a selected scenario during another scenario deletion', async () => {
        const controller = new PlaytestDraftController();
        controller.select(scenario);
        const pending = pendingDelete(controller);
        controller.select({ ...scenario, id: 'B', name: 'Original B' });
        pending.resolve(true);
        await pending.completed;
        expect(controller.value).toMatchObject({ id: 'B', name: 'Original B' });
    });

    it.each([false, true])('only clears the unchanged deleted draft after success=%s', async success => {
        const controller = new PlaytestDraftController();
        controller.select(scenario);
        const pending = pendingDelete(controller);
        pending.resolve(success);
        await pending.completed;
        expect(controller.value.name).toBe(success ? '' : 'Original A');
    });

    it('does not assign an old saved ID to a newly cleared draft', async () => {
        const controller = new PlaytestDraftController();
        controller.edit({ name: 'First new draft' });
        const pending = pendingSave(controller);
        controller.clear();
        controller.edit({ name: 'Second new draft' });
        pending.resolve(true);
        await pending.completed;
        expect(controller.value).toMatchObject({ id: '', name: 'Second new draft' });
    });

    it('retires completion and error ownership on unmount, including reactivation', async () => {
        const controller = new PlaytestDraftController();
        controller.select(scenario);
        const pending = pendingSave(controller);
        controller.retire();
        expect(controller.isActive(pending.lease)).toBe(false);
        controller.activate();
        pending.resolve(true);
        await pending.completed;
        expect(controller.owns(pending.lease)).toBe(false);
        expect(controller.owns(controller.capture())).toBe(true);
    });

    it('rejects leases from replacement projects even with identical draft counters', () => {
        const original = new PlaytestDraftController();
        const successor = new PlaytestDraftController();
        const lease = original.capture();
        expect(successor.owns(lease)).toBe(false);
        expect(successor.completeSave(lease, scenario)).toBe(false);
        expect(successor.completeDelete(lease)).toBe(false);
        expect(successor.value.id).toBe('');
    });
});
