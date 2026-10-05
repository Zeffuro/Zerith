import { describe, expect, it, vi } from 'vitest';

import { Engine } from '../../Engine';
import { SceneManager } from '../SceneManager';

function deferred() {
    let resolve!: () => void;
    const promise = new Promise<void>(done => { resolve = done; });
    return { promise, resolve };
}

function scenes() {
    const first = deferred();
    const second = deferred();
    const emit = vi.fn();
    const manager = new SceneManager({
        assets: { preloadSceneAssets: vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise) },
        events: { emit },
        logger: { error: vi.fn() },
    });
    manager.loadScenes({ intro: [{ name: 'intro', type: 'label' }], platform: [{ name: 'platform', type: 'label' }] });
    return { emit, first, manager, second };
}

describe('scene preload ownership', () => {
    it('keeps the newer scene when an earlier preload completes later', async () => {
        const context = scenes();
        const first = context.manager.jumpToScene('intro');
        const second = context.manager.jumpToScene('platform', 1);
        context.second.resolve();
        await second;
        const eventsBefore = context.emit.mock.calls.length;
        context.first.resolve();
        await first;
        expect(context.manager.currentSceneName).toBe('platform');
        expect(context.manager.currentIndex).toBe(1);
        expect(context.manager.getCommandAt(0)).toEqual({ name: 'platform', type: 'label' });
        expect(context.emit.mock.calls).toHaveLength(eventsBefore);
    });

    it('does not apply a pending scene after replacing the project scenes', async () => {
        const context = scenes();
        const pending = context.manager.jumpToScene('intro');
        context.manager.loadScenes({ intro: [{ name: 'new intro', type: 'label' }] });
        context.first.resolve();
        await pending;
        expect(context.manager.script).toEqual([]);
        expect(context.manager.currentSceneName).toBe('');
    });

    it('clears a pending loading overlay before clearing engine layers and keeps Stop cancelled', async () => {
        const context = scenes();
        const pending = context.manager.jumpToScene('intro');
        const clearLayers = vi.fn(() => { expect(context.emit).toHaveBeenLastCalledWith('scene:loaded', 'intro'); });
        Engine.prototype.clear.call({
            animations: { clear: vi.fn() },
            audio: { stopAll: vi.fn() },
            display: { clearLayers },
            flow: { reset: vi.fn(), resetHandlers: vi.fn() },
            history: { clear: vi.fn() },
            items: { clear: vi.fn() },
            scenes: context.manager,
            stateManager: { clear: vi.fn() },
        } as unknown as Engine);
        context.manager.addScene('preview', []);
        const eventsBefore = context.emit.mock.calls.length;
        context.first.resolve();
        await pending;
        expect(clearLayers).toHaveBeenCalledOnce();
        expect(context.manager.currentSceneName).toBe('');
        expect(context.manager.script).toEqual([]);
        expect(context.emit.mock.calls).toHaveLength(eventsBefore);
    });

    it('rejects an old preload after replacing that scene in place', async () => {
        const context = scenes();
        const pending = context.manager.jumpToScene('intro');
        context.manager.addScene('intro', [{ name: 'updated intro', type: 'label' }]);
        context.first.resolve();
        await pending;
        expect(context.manager.script).toEqual([]);
    });
});
