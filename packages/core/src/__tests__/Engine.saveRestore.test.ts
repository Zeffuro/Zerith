import { describe, expect, it, vi } from 'vitest';

import { Engine, type EngineDeps } from '../Engine';
import { EventBus } from '../managers/EventBus';
import { HistoryManager } from '../managers/HistoryManager';
import { type SaveState } from '../managers/SaveManager';
import { SceneManager } from '../managers/SceneManager';
import { StateManager } from '../managers/StateManager';
import { createDefaultSystemState } from '../types';

function harness() {
    const events = new EventBus();
    const preload = vi.fn(async () => {});
    const scenes = new SceneManager({ assets: { preloadSceneAssets: preload }, events, logger: { error: vi.fn() } });
    scenes.loadScenes({ intro: [{ speaker: 'Narrator', text: 'Saved line', type: 'dialogue' }] });
    scenes.currentSceneName = 'intro';
    const state = new StateManager(events);
    state.replaceState({ current: true });
    const history = new HistoryManager();
    history.push('Narrator', 'Current line');
    const release = vi.fn();
    const flow = { acquireSuspension: vi.fn(() => release), destroyHandlers: vi.fn(), isStarted: true,
        reset: vi.fn(), resetHandlers: vi.fn(), restoreSaveContinuation: vi.fn(), start: vi.fn(), stop: vi.fn() };
    const items = { clear: vi.fn(), deserialize: vi.fn() };
    const engine = new Engine({}, { animations: { clear: vi.fn() }, assets: { preloadSceneAssets: preload }, audio: { stopAll: vi.fn() },
        display: { clearLayers: vi.fn() }, events, flow, history, input: { detach: vi.fn() }, items,
        notifications: {}, overlay: {}, saves: {}, scenes, spritesheets: {}, startScreen: {}, state } as unknown as EngineDeps);
    const save: SaveState = { index: 0, meta: { savedAt: 1, sceneName: 'intro', slot: 1 }, saveSchemaVersion: 2, sceneName: 'intro', state: { restored: true },
        system: createDefaultSystemState() };
    return { engine, flow, history, items, preload, release, save, scenes, state };
}

describe('Engine save restoration', () => {
    it('rejects direct unknown save versions before touching the current game', async () => {
        const h = harness();
        await expect(h.engine.applySaveState({ ...h.save, saveSchemaVersion: 999 } as unknown as SaveState)).rejects.toThrow(/version/);
        expect(h.flow.reset).not.toHaveBeenCalled();
    });

    it('preloads saved presentation assets from previous scenes strictly before clearing', async () => {
        const h = harness();
        h.save.system.background = '/old-background.png';
        h.save.system.bgm = '/old-music.ogg';
        h.save.system.sprites.guide = { assetUrl: '/old-guide.png' };
        h.preload.mockResolvedValueOnce().mockRejectedValueOnce(new Error('Missing saved background'));
        await expect(h.engine.applySaveState(h.save)).rejects.toThrow('Missing saved background');
        expect(h.preload).toHaveBeenLastCalledWith([
            { assetUrl: '/old-background.png', type: 'background' },
            { action: 'play', assetUrl: '/old-music.ogg', type: 'bgm' },
            { action: 'show', assetUrl: '/old-guide.png', id: 'guide', type: 'sprite' },
        ], { strict: true });
        expect(h.flow.reset).not.toHaveBeenCalled();
        expect(h.state.state).toEqual({ current: true });
    });
    it.each([-1, 0.5, Number.MAX_SAFE_INTEGER + 1, 2])('rejects cursor %s without clearing the current game', async index => {
        const h = harness();
        await expect(h.engine.applySaveState({ ...h.save, index })).rejects.toThrow(/cursor/);
        expect(h.state.state).toEqual({ current: true });
        expect(h.history.length).toBe(1);
        expect(h.flow.reset).not.toHaveBeenCalled();
    });

    it('preserves the current game when assets fail to preload', async () => {
        const h = harness();
        h.preload.mockRejectedValueOnce(new Error('Missing asset'));
        await expect(h.engine.applySaveState(h.save)).rejects.toThrow('Missing asset');
        expect(h.state.state).toEqual({ current: true });
        expect(h.flow.reset).not.toHaveBeenCalled();
        expect(h.release).toHaveBeenCalledTimes(1);
    });

    it('rejects navigation during saved presentation preloading after scene preparation', async () => {
        const h = harness();
        h.save.system.background = '/saved-background.png';
        let finish!: () => void;
        h.preload.mockResolvedValueOnce().mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve; }));
        const load = h.engine.applySaveState(h.save);
        await vi.waitFor(() => expect(h.preload).toHaveBeenCalledTimes(2));
        h.scenes.cancelSceneLoad();
        finish();
        await expect(load).rejects.toThrow(/changed/);
        expect(h.flow.reset).not.toHaveBeenCalled();
        expect(h.state.state).toEqual({ current: true });
    });

    it('rejects missing scenes and stale content before destructive cleanup', async () => {
        const h = harness();
        await expect(h.engine.applySaveState({ ...h.save, sceneName: 'missing' })).rejects.toThrow();
        let finish!: () => void;
        h.preload.mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve; }));
        const load = h.engine.applySaveState(h.save);
        h.scenes.addScene('intro', [{ speaker: 'Narrator', text: 'Edited line', type: 'dialogue' }]);
        finish();
        await expect(load).rejects.toThrow(/changed/);
        expect(h.flow.reset).not.toHaveBeenCalled();
        expect(h.state.state).toEqual({ current: true });
    });

    it.each(['clear', 'stop', 'destroy'] as const)('%s cancels a pending restore', async operation => {
        const h = harness();
        let finish!: () => void;
        h.preload.mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve; }));
        const load = h.engine.applySaveState(h.save);
        h.engine[operation]();
        finish();
        await expect(load).rejects.toThrow(/changed|cancelled/);
        expect(h.state.state).not.toHaveProperty('restored');
        expect(h.release).toHaveBeenCalledTimes(1);
    });

    it('gives the latest load ownership and never resurrects an older prepared save', async () => {
        const h = harness();
        let finish!: () => void;
        h.preload.mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve; }));
        const old = h.engine.applySaveState(h.save);
        await h.engine.applySaveState({ ...h.save, state: { latest: true } });
        finish();
        await expect(old).rejects.toThrow(/changed|cancelled/);
        expect(h.state.state).toEqual({ latest: true });
        expect(h.flow.reset).toHaveBeenCalledTimes(1);
    });

    it('commits state, inventory and history and starts playback without awaiting a presentation', async () => {
        const h = harness();
        h.flow.start.mockImplementation(() => { void new Promise(() => {}); });
        await h.engine.applySaveState(h.save);
        expect(h.state.state).toEqual({ restored: true });
        expect(h.history.length).toBe(0);
        expect(h.items.deserialize).toHaveBeenCalledWith([]);
        expect(h.flow.start).toHaveBeenCalledTimes(1);
        expect(h.release).toHaveBeenCalledTimes(1);
    });
});
