import { describe, expect, it, vi } from 'vitest';

import type { FlowContinuation } from '../flowContinuation';

import { createDefaultSystemState } from '../../types';
import { SaveManager } from '../SaveManager';

function harness() {
    const values = new Map<string, string>();
    const storage = { getItem: (key: string) => values.get(key), removeItem: (key: string) => { values.delete(key); },
        setItem: (key: string, value: string) => { values.set(key, value); } };
    const context = { getCurrentSceneName: () => 'intro', getLastSavePoint: () => 0,
        getStateSnapshot: () => ({}), getSystemSnapshot: createDefaultSystemState,
        logInfo: vi.fn(), logWarn: vi.fn(), serializeItems: () => [] };
    return { context, storage, values };
}

const continuation: FlowContinuation = { injectedCommands: [{ speaker: 'Narrator', text: 'Pending', type: 'dialogue' }], nextIndex: 1,
    replay: { command: { speaker: 'Narrator', text: 'Current', type: 'dialogue' }, kind: 'dialogue' },
    runtimeScript: [{ command: { name: 'nested', type: 'call' }, kind: 'original', originalIndex: 0 }],
    sourceFingerprint: 'source' };

describe('SaveManager continuation validation', () => {
    it('persists a detached version two checkpoint and roundtrips it', async () => {
        const h = harness();
        const snapshot = structuredClone(continuation);
        const manager = new SaveManager({ ...h.context, getFlowContinuation: () => snapshot }, h.storage);
        manager.save(1);
        snapshot.injectedCommands.length = 0;
        expect(await manager.load(1)).toMatchObject({ continuation, saveSchemaVersion: 2 });
    });

    it('leaves an existing slot untouched when capture is unsafe', () => {
        const h = harness();
        h.values.set('zerith_save_1', 'previous');
        const manager = new SaveManager({ ...h.context, getFlowContinuation: () => { throw new Error('Wait for command'); } }, h.storage);
        expect(() => manager.save(1)).toThrow('Wait for command');
        expect(h.values.get('zerith_save_1')).toBe('previous');
    });

    it.each([-1, 0.5, Number.MAX_SAFE_INTEGER + 1, JSON.parse('null') as unknown])('rejects stored invalid cursor %s', async index => {
        const h = harness();
        h.values.set('zerith_save_1', JSON.stringify({ index, sceneName: 'intro', state: {} }));
        expect(await new SaveManager(h.context, h.storage).load(1)).toBeUndefined();
    });

    it.each([3, -1, '2', JSON.parse('null') as unknown])('rejects unknown explicit save version %s', async saveSchemaVersion => {
        const h = harness();
        h.values.set('zerith_save_1', JSON.stringify({ index: 0, saveSchemaVersion, sceneName: 'intro', state: {} }));
        expect(await new SaveManager(h.context, h.storage).load(1)).toBeUndefined();
    });

    it.each([0, 1])('loads bounded legacy version %s without a continuation', async saveSchemaVersion => {
        const h = harness();
        h.values.set('zerith_save_1', JSON.stringify({ index: 0, saveSchemaVersion, sceneName: 'intro', state: {} }));
        expect(await new SaveManager(h.context, h.storage).load(1)).toMatchObject({ index: 0, saveSchemaVersion });
    });

    it.each([{ ...continuation, nextIndex: 2 }, { ...continuation, replay: { command: { key: 'x', type: 'set', value: 1 }, kind: 'dialogue' } }])('rejects malformed continuations rather than falling back to the root cursor', async bad => {
            const h = harness();
            h.values.set('zerith_save_1', JSON.stringify({ continuation: bad, index: 0, saveSchemaVersion: 2, sceneName: 'intro', state: {} }));
            expect(await new SaveManager(h.context, h.storage).load(1)).toBeUndefined();
        });
});
