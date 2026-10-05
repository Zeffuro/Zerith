import { describe, expect, it, vi } from 'vitest';

import type { BaseCommand } from '../../types';
import type { FlowContinuation } from '../flowContinuation';

import { parseFlowContinuation } from '../flowContinuation';
import { SceneManager } from '../SceneManager';

const line = (text: string) => ({ speaker: 'Guide', text, type: 'dialogue' });

function continuation(scenes: SceneManager): FlowContinuation {
    return { ...scenes.captureSceneContinuation(), injectedCommands: [] };
}

async function createContext() {
    const preload = vi.fn<(commands: BaseCommand[]) => Promise<void>>().mockResolvedValue();
    const emit = vi.fn();
    const scenes = new SceneManager({ assets: { preloadSceneAssets: preload }, events: { emit }, logger: { error: vi.fn() } });
    const intro = [line('First'), line('Second')];
    scenes.loadScenes({ intro, other: [line('Other')] });
    scenes.registerTemplate('greeting', [line('Macro')]);
    await scenes.jumpToScene('intro', 1);
    preload.mockClear();
    return { emit, intro, preload, scenes };
}

function deferred() {
    let resolve!: () => void;
    const promise = new Promise<void>(done => { resolve = done; });
    return { promise, resolve };
}

describe('prepared save scene restore', () => {
    it('prepares without changing playback and commits a detached complete runtime snapshot', async () => {
        const context = await createContext();
        context.scenes.injectCommands([line('Scene injected')]);
        const saved = continuation(context.scenes);
        saved.injectedCommands = [{ assetUrl: 'pending.png', type: 'background' }];
        saved.replay = { command: line('Current replay'), kind: 'dialogue' };
        const before = context.scenes.script;
        const prepared = await context.scenes.prepareSaveRestore('intro', 0, saved);
        expect(context.scenes.currentIndex).toBe(1);
        expect(context.scenes.script).toEqual(before);
        expect(context.preload).toHaveBeenCalledExactlyOnceWith([...before, ...saved.injectedCommands, saved.replay.command], { strict: true });
        expect(context.scenes.isPreparedRestoreCurrent(prepared)).toBe(true);
        context.scenes.cancelSceneLoad();
        expect(context.scenes.isPreparedRestoreCurrent(prepared)).toBe(false);
        context.scenes.commitSaveRestore(prepared);
        prepared.runtimeScript[0].command.text = 'Changed returned data';
        saved.runtimeScript[1].command.text = 'Changed caller data';
        expect(context.scenes.getCommandAt(0)?.text).toBe('First');
        expect(context.scenes.getCommandAt(1)?.text).toBe('Scene injected');
        expect(() => context.scenes.commitSaveRestore(prepared)).toThrow('changed');
    });

    it.each([-1, -1_000_000_000, 0.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1, 3])('rejects legacy index %s without preloading or changing playback', async index => {
        const context = await createContext();
        await expect(context.scenes.prepareSaveRestore('intro', index)).rejects.toThrow('cursor');
        expect(context.preload).not.toHaveBeenCalled();
        expect(context.scenes.currentIndex).toBe(1);
        expect(context.scenes.getCommandAt(1)?.text).toBe('Second');
    });

    it('allows the end cursor and empty scenes', async () => {
        const context = await createContext();
        const end = await context.scenes.prepareSaveRestore('intro', 2);
        context.scenes.commitSaveRestore(end);
        expect(context.scenes.currentIndex).toBe(2);
        context.scenes.addScene('empty', []);
        const empty = await context.scenes.prepareSaveRestore('empty', 0);
        context.scenes.commitSaveRestore(empty);
        expect(context.scenes.currentSceneName).toBe('empty');
        expect(context.scenes.scriptLength).toBe(0);
    });

    it('rejects missing scenes and asset failure without clearing current playback', async () => {
        const context = await createContext();
        await expect(context.scenes.prepareSaveRestore('missing', 0)).rejects.toThrow('missing');
        context.preload.mockRejectedValueOnce(new Error('Asset failed'));
        await expect(context.scenes.prepareSaveRestore('other', 0)).rejects.toThrow('Asset failed');
        expect(context.scenes.currentSceneName).toBe('intro');
        expect(context.scenes.currentIndex).toBe(1);
        expect(context.scenes.getCommandAt(0)?.text).toBe('First');
    });

    it.each(['root', 'template'])('rejects changed %s content before preloading', async kind => {
        const context = await createContext();
        const saved = continuation(context.scenes);
        if (kind === 'root') context.intro[0].text = 'Edited root';
        else context.scenes.registerTemplate('greeting', [line('Edited macro')]);
        await expect(context.scenes.prepareSaveRestore('intro', 0, saved)).rejects.toThrow('content changed');
        expect(context.preload).not.toHaveBeenCalled();
        expect(context.scenes.currentIndex).toBe(1);
    });

    it.each(['missing original', 'reordered original', 'changed original', 'duplicate original'])('rejects %s runtime entries even with the correct fingerprint', async kind => {
        const context = await createContext();
        const saved = continuation(context.scenes);
        if (kind === 'missing original') saved.runtimeScript.pop();
        if (kind === 'reordered original') saved.runtimeScript.reverse();
        if (kind === 'changed original') saved.runtimeScript[0].command.text = 'Tampered';
        if (kind === 'duplicate original') saved.runtimeScript.push(saved.runtimeScript[0]);
        await expect(context.scenes.prepareSaveRestore('intro', 0, saved)).rejects.toThrow('content changed');
        expect(context.preload).not.toHaveBeenCalled();
    });

    it('does not treat object key order or template insertion order as changed content', async () => {
        const context = await createContext();
        context.scenes.registerTemplate('a', [line('A')]);
        const saved = continuation(context.scenes);
        context.scenes.addScene('intro', [
            { speaker: 'Guide', text: 'First', type: 'dialogue' },
            { speaker: 'Guide', text: 'Second', type: 'dialogue' },
        ]);
        const prepared = await context.scenes.prepareSaveRestore('intro', 0, saved);
        expect(context.scenes.isPreparedRestoreCurrent(prepared)).toBe(true);
    });

    it.each(['navigation', 'cancel', 'root', 'template'])('rejects %s changes during preloading', async kind => {
        const context = await createContext();
        const pending = deferred();
        context.preload.mockReturnValueOnce(pending.promise);
        const preparing = context.scenes.prepareSaveRestore('intro', 0, continuation(context.scenes));
        if (kind === 'navigation') await context.scenes.jumpToScene('other');
        if (kind === 'cancel') context.scenes.cancelSceneLoad();
        if (kind === 'root') context.scenes.addScene('intro', [line('Updated')]);
        if (kind === 'template') context.scenes.registerTemplate('greeting', [line('Updated')]);
        pending.resolve();
        await expect(preparing).rejects.toThrow(/changed/);
        expect(context.scenes.currentSceneName).toBe(kind === 'navigation' ? 'other' : 'intro');
    });

    it('rejects source changes after preparation and before commit', async () => {
        const context = await createContext();
        const prepared = await context.scenes.prepareSaveRestore('intro', 0, continuation(context.scenes));
        context.scenes.registerTemplate('greeting', [line('Changed')]);
        expect(context.scenes.isPreparedRestoreCurrent(prepared)).toBe(false);
        expect(() => context.scenes.commitSaveRestore(prepared)).toThrow('changed');
        expect(context.scenes.currentIndex).toBe(1);
    });

    it('bounds direct cursor input and original-index lookup', async () => {
        const context = await createContext();
        await expect(context.scenes.jumpToScene('intro', -1)).rejects.toThrow('cursor');
        expect(context.scenes.getLastOriginalIndex(Number.MAX_SAFE_INTEGER)).toBe(1);
        expect(context.scenes.getLastOriginalIndex(-1)).toBe(0);
        expect(context.scenes.getLastOriginalIndex(Number.NaN)).toBe(0);
        expect(context.scenes.currentIndex).toBe(1);
    });

    it('rejects tampered prepared injected commands before commit', async () => {
        const context = await createContext();
        const saved = continuation(context.scenes);
        saved.runtimeScript.splice(1, 0, { command: line('Injected'), kind: 'injected' });
        const prepared = await context.scenes.prepareSaveRestore('intro', 0, saved);
        prepared.runtimeScript[1].command.type = '';
        expect(context.scenes.isPreparedRestoreCurrent(prepared)).toBe(false);
        expect(() => context.scenes.commitSaveRestore(prepared)).toThrow('changed');
        expect(context.scenes.currentIndex).toBe(1);
    });

    it('invalidates completed preparation after navigation before commit', async () => {
        const context = await createContext();
        const prepared = await context.scenes.prepareSaveRestore('intro', 0, continuation(context.scenes));
        await context.scenes.jumpToScene('other');
        expect(context.scenes.isPreparedRestoreCurrent(prepared)).toBe(false);
        expect(context.scenes.currentSceneName).toBe('other');
    });

    it('preloads referenced recursive templates once each through choice branches', async () => {
        const context = await createContext();
        context.scenes.addScene('intro', [{ name: 'outer', type: 'call' }, { name: 'outer', type: 'call' }]);
        const outer = [{ assetUrl: 'outer.png', type: 'background' }, { name: 'inner', type: 'call' }, { name: 'outer', type: 'call' }];
        const inner = [{ options: [{ commands: [{ assetUrl: 'inner.wav', type: 'sfx' }], label: 'Inside' }], type: 'choice' }];
        context.scenes.registerTemplate('outer', outer);
        context.scenes.registerTemplate('inner', inner);
        context.scenes.registerTemplate('unused', [{ assetUrl: 'missing.png', type: 'background' }]);
        await context.scenes.prepareSaveRestore('intro', 0);
        expect(context.preload).toHaveBeenCalledExactlyOnceWith([
            { name: 'outer', type: 'call' }, { name: 'outer', type: 'call' }, ...outer, ...inner,
        ], { strict: true });
    });
});

describe('bounded continuation parsing', () => {
    it('detaches valid commands, keeps plugin fields and omits optional undefined object members', async () => {
        const context = await createContext();
        const saved = continuation(context.scenes);
        saved.injectedCommands = [{ optional: undefined, payload: { data: [1, true] }, type: 'plugin_custom' }];
        const parsed = parseFlowContinuation(saved);
        expect(parsed?.injectedCommands).toEqual([{ payload: { data: [1, true] }, type: 'plugin_custom' }]);
        saved.runtimeScript[0].command.text = 'Later mutation';
        expect(parsed?.runtimeScript[0].command.text).toBe('First');
    });

    it.each([
        { nextIndex: -1 }, { nextIndex: 0.25 }, { nextIndex: 3 }, { nextIndex: Number.MAX_SAFE_INTEGER + 1 },
        { runtimeScript: [{ command: line('Bad'), kind: 'original', originalIndex: -1 }] },
        { injectedCommands: [{ type: 1 }] }, { injectedCommands: [{ type: '' }] },
        { injectedCommands: [{ type: 'dialogue' }] },
        { injectedCommands: [{ from: 0, to: 1e100, type: 'for' }] },
        { injectedCommands: [{ from: 1e20, step: 1, to: 1e20, type: 'for' }] },
        { injectedCommands: [{ from: Number.MAX_SAFE_INTEGER, step: 1, to: Number.MAX_SAFE_INTEGER + 1, type: 'for' }] },
        { injectedCommands: [{ maxIterations: 1e100, type: 'while' }] },
        { replay: { command: line('Line'), kind: 'choice' } },
        { sourceFingerprint: '' },
    ])('rejects malformed fields %j', async overrides => {
        const context = await createContext();
        expect(parseFlowContinuation({ ...continuation(context.scenes), ...overrides })).toBeUndefined();
    });

    it.each([() => {}, Number.NaN, Number.POSITIVE_INFINITY, new Date(), [undefined]])('rejects nonserializable command data %s', async payload => {
        const context = await createContext();
        const saved = continuation(context.scenes);
        saved.injectedCommands = [{ payload, type: 'plugin_custom' }];
        expect(parseFlowContinuation(saved)).toBeUndefined();
    });

    it('rejects cyclic, excessively deep, large and numerous data', async () => {
        const context = await createContext();
        const saved = continuation(context.scenes);
        const cycle: Record<string, unknown> = {};
        cycle.self = cycle;
        saved.injectedCommands = [{ payload: cycle, type: 'plugin_custom' }];
        expect(parseFlowContinuation(saved)).toBeUndefined();
        let nested: unknown = 'leaf';
        for (let index = 0; index < 65; index++) nested = { child: nested };
        saved.injectedCommands = [{ payload: nested, type: 'plugin_custom' }];
        expect(parseFlowContinuation(saved)).toBeUndefined();
        saved.injectedCommands = [{ payload: 'x'.repeat(4 * 1024 * 1024), type: 'plugin_custom' }];
        expect(parseFlowContinuation(saved)).toBeUndefined();
        saved.injectedCommands = Array.from({ length: 50_001 }, () => ({ type: 'plugin_custom' }));
        expect(parseFlowContinuation(saved)).toBeUndefined();
    });

    it('rejects sparse arrays, accessors and hidden serialization hooks', async () => {
        const context = await createContext();
        const saved = continuation(context.scenes);
        saved.injectedCommands = [];
        saved.injectedCommands.length = 1;
        expect(parseFlowContinuation(saved)).toBeUndefined();
        const command = { type: 'plugin_custom' };
        Object.defineProperty(command, 'toJSON', { value: () => ({ type: 'dialogue' }) });
        saved.injectedCommands = [command];
        expect(parseFlowContinuation(saved)).toBeUndefined();
        const accessor = { get payload() { return 1; }, type: 'plugin_custom' };
        saved.injectedCommands = [accessor];
        expect(parseFlowContinuation(saved)).toBeUndefined();
    });

    it('bounds generated for commands and preserves valid fractional iterations', async () => {
        const context = await createContext();
        const saved = continuation(context.scenes);
        saved.injectedCommands = [{ body: [line('Body')], from: 0.5, step: 0.25, to: 1, type: 'for' }];
        expect(parseFlowContinuation(saved)).toBeDefined();
        saved.injectedCommands = [{ body: Array.from({ length: 100 }, () => line('Body')), from: 0, to: 500, type: 'for' }];
        expect(parseFlowContinuation(saved)).toBeUndefined();
    });

    it('shares a bounded parsing-work budget across individually valid loops', async () => {
        const context = await createContext();
        const saved = continuation(context.scenes);
        saved.injectedCommands = Array.from({ length: 5000 }, () => ({ from: 0, to: 49_999, type: 'for' }));
        expect(parseFlowContinuation(saved)).toBeUndefined();
    });
});
