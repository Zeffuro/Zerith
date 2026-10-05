import { Container, Sprite, Texture } from 'pixi.js';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { IDisplayManager } from '../../interfaces/managers';
import type { SaveState } from '../../managers/SaveManager';

import { EventBus } from '../../managers/EventBus';
import { StateManager } from '../../managers/StateManager';
import { createAssetManagerMock } from '../../test-utils/audioHarness';
import { createDefaultSystemState } from '../../types';
import { BackgroundHandler } from '../BackgroundHandler';

function deferred<T>() {
    let resolve!: (value: T) => void;
    let reject!: (error: Error) => void;
    const promise = new Promise<T>((resolvePromise, rejectPromise) => { resolve = resolvePromise; reject = rejectPromise; });
    return { promise, reject, resolve };
}

function fixture() {
    const layer = new Container();
    const events = new EventBus();
    const state = new StateManager(events);
    const load = vi.fn<(url: string) => Promise<Texture | undefined>>().mockResolvedValue(Texture.WHITE);
    const assets = createAssetManagerMock({ load: <T>(url: string) => load(url) as Promise<T> });
    const display = { getLayer: () => layer, height: 720, width: 1280 };
    const handler = new BackgroundHandler(assets, display as unknown as IDisplayManager, state, events);
    const execute = (assetUrl: string) => handler.execute({ assetUrl, type: 'background' });
    const restore = (background?: string) => {
        const system = { ...createDefaultSystemState(), background };
        const save: SaveState = { index: 0, meta: { savedAt: 0, sceneName: 'intro', slot: 1 }, sceneName: 'intro', state: {}, system };
        state.replaceState(save.state, system);
        events.emit('state:loaded', save);
    };
    return { display, events, execute, handler, layer, load, restore, state };
}

describe('BackgroundHandler pending-load ownership', () => {
    afterEach(() => vi.restoreAllMocks());

    it('keeps B visible and saved when A completes after reset and B', async () => {
        const h = fixture();
        const delayed = deferred<Texture>();
        h.load.mockReturnValueOnce(delayed.promise);
        const old = h.execute('A');
        h.handler.reset();
        await h.execute('B');
        const sprite = h.layer.children[0];
        delayed.resolve(Texture.EMPTY);
        await old;
        expect(h.layer.children).toEqual([sprite]);
        expect((sprite as Sprite).texture).toBe(Texture.WHITE);
        expect(h.state.system.background).toBe('B');
        h.handler.destroy();
    });

    it.each(['before', 'after'] as const)('ignores an older success %s the newest completion', async order => {
        const h = fixture();
        await h.execute('initial');
        const first = deferred<Texture>();
        const second = deferred<Texture>();
        h.load.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
        const old = h.execute('A');
        const latest = h.execute('B');
        if (order === 'before') {
            first.resolve(Texture.EMPTY);
            await old;
            expect(h.state.system.background).toBe('initial');
        }
        second.resolve(Texture.WHITE);
        await latest;
        first.resolve(Texture.EMPTY);
        await old;
        expect(h.layer.children).toHaveLength(1);
        expect((h.layer.children[0] as Sprite).texture).toBe(Texture.WHITE);
        expect(h.state.system.background).toBe('B');
        h.handler.destroy();
    });

    it.each(['reject', 'missing'] as const)('ignores a stale %s after reset or a newer request', async outcome => {
        for (const reset of [false, true]) {
            const h = fixture();
            const delayed = deferred<Texture | undefined>();
            h.load.mockReturnValueOnce(delayed.promise);
            const old = h.execute('A');
            if (reset) h.handler.reset();
            await h.execute('B');
            if (outcome === 'reject') delayed.reject(new Error('old failure'));
            // eslint-disable-next-line unicorn/no-useless-undefined -- The typed resolver requires a value.
            else delayed.resolve(undefined);
            await expect(old).resolves.toBeUndefined();
            expect(h.state.system.background).toBe('B');
            expect(h.layer.children).toHaveLength(1);
            h.handler.destroy();
        }
    });

    it.each(['reject', 'missing'] as const)('reports the current %s and retains the previous presentation', async outcome => {
        const h = fixture();
        await h.execute('initial');
        const sprite = h.layer.children[0];
        if (outcome === 'reject') h.load.mockRejectedValueOnce(new Error('current failure'));
        // eslint-disable-next-line unicorn/no-useless-undefined -- The typed mock requires a value.
        else h.load.mockResolvedValueOnce(undefined);
        await expect(h.execute('B')).rejects.toThrow(outcome === 'reject' ? 'current failure' : 'Failed to load background texture: B');
        expect(h.layer.children).toEqual([sprite]);
        expect(h.state.system.background).toBe('initial');
        await h.execute('retry');
        expect(h.state.system.background).toBe('retry');
        h.handler.destroy();
    });

    it('does not revive A when the newest request fails', async () => {
        const h = fixture();
        await h.execute('initial');
        const delayed = deferred<Texture>();
        h.load.mockReturnValueOnce(delayed.promise).mockRejectedValueOnce(new Error('B failed'));
        const old = h.execute('A');
        await expect(h.execute('B')).rejects.toThrow('B failed');
        delayed.resolve(Texture.EMPTY);
        await old;
        expect(h.state.system.background).toBe('initial');
        expect((h.layer.children[0] as Sprite).texture).toBe(Texture.WHITE);
        h.handler.destroy();
    });

    it.each([undefined, 'restored-B'])('restoration of %s invalidates old work and removes the previous sprite', async background => {
        const h = fixture();
        await h.execute('initial');
        const sprite = h.layer.children[0] as Sprite;
        const delayed = deferred<Texture>();
        h.load.mockReturnValueOnce(delayed.promise);
        const old = h.execute('A');
        h.restore(background);
        expect(sprite.destroyed).toBe(true);
        if (background) await vi.waitFor(() => expect(h.layer.children).toHaveLength(1));
        delayed.resolve(Texture.EMPTY);
        await old;
        expect(h.layer.children).toHaveLength(background ? 1 : 0);
        expect(h.state.system.background).toBe(background);
        h.handler.destroy();
    });

    it('owns consecutive saved-state restores and handles their failures', async () => {
        const h = fixture();
        const error = vi.spyOn(console, 'error').mockImplementation(() => {});
        const old = deferred<Texture>();
        h.load.mockReturnValueOnce(old.promise);
        h.restore('A');
        h.restore('B');
        await vi.waitFor(() => expect(h.layer.children).toHaveLength(1));
        old.reject(new Error('stale restore failure'));
        await Promise.resolve();
        await Promise.resolve();
        expect(error).not.toHaveBeenCalled();
        expect(h.state.system.background).toBe('B');
        h.load.mockRejectedValueOnce(new Error('current restore failure'));
        h.restore('C');
        await vi.waitFor(() => expect(error).toHaveBeenCalledOnce());
        expect(error.mock.calls[0].at(-1)).toEqual(new Error('current restore failure'));
        expect(h.layer.children).toHaveLength(0);
        h.handler.destroy();
    });

    it.each(['success', 'reject', 'missing'] as const)('destroy ends sprite and event ownership before pending %s', async outcome => {
        const h = fixture();
        await h.execute('initial');
        const sprite = h.layer.children[0] as Sprite;
        const destroyTexture = vi.spyOn(Texture.WHITE, 'destroy');
        const delayed = deferred<Texture | undefined>();
        h.load.mockReturnValueOnce(delayed.promise);
        const old = h.execute('A');
        h.handler.destroy();
        h.handler.destroy();
        if (outcome === 'reject') delayed.reject(new Error('destroyed load'));
        else delayed.resolve(outcome === 'missing' ? undefined : Texture.EMPTY);
        await old;
        await h.execute('after-destroy');
        h.restore('event-after-destroy');
        expect(h.load).toHaveBeenCalledTimes(2);
        expect(h.layer.children).toHaveLength(0);
        expect(sprite.destroyed).toBe(true);
        expect(destroyTexture).not.toHaveBeenCalled();
    });

    it('reuses its sprite at the current display size and captures the requested URL', async () => {
        const h = fixture();
        await h.execute('initial');
        const sprite = h.layer.children[0];
        h.display.width = 640;
        h.display.height = 360;
        const delayed = deferred<Texture>();
        h.load.mockReturnValueOnce(delayed.promise);
        const command = { assetUrl: 'requested', type: 'background' as const };
        const loading = h.handler.execute(command);
        command.assetUrl = 'mutated';
        delayed.resolve(Texture.WHITE);
        await loading;
        expect(h.layer.children).toEqual([sprite]);
        expect({ height: sprite.height, width: sprite.width }).toEqual({ height: 360, width: 640 });
        expect(h.state.system.background).toBe('requested');
        h.handler.destroy();
    });
});
