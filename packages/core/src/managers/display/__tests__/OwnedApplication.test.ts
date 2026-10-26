import type { ApplicationPlugin, Renderer } from 'pixi.js';

import { Application, Container, Sprite, Texture, TickerPlugin } from 'pixi.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { OwnedApplication } from '../OwnedApplication';

const selection = vi.hoisted(() => vi.fn());
vi.mock('../ownedRenderer', async importOriginal => ({
    ...await importOriginal<typeof import('../ownedRenderer')>(),
    createOwnedRenderer: selection,
}));

function deferred() {
    let resolve!: () => void;
    let reject!: (error: Error) => void;
    const promise = new Promise<void>((complete, fail) => { resolve = complete; reject = fail; });
    return { promise, reject, resolve };
}

function renderer(init = vi.fn(() => Promise.resolve())) {
    const items: { destroy: ReturnType<typeof vi.fn> }[] = [];
    const runner = {
        items,
        remove(item: { destroy: ReturnType<typeof vi.fn> }) { items.splice(items.indexOf(item), 1); },
    };
    return { destroy: vi.fn(), init, runners: { destroy: runner } };
}

describe('OwnedApplication initialization and disposal', () => {
    let previousPlugins: ApplicationPlugin[];
    beforeEach(() => {
        previousPlugins = Application._plugins;
        Application._plugins = [];
        selection.mockReset();
    });
    afterEach(() => { Application._plugins = previousPlugins; vi.restoreAllMocks(); });

    it('owns a partial renderer before initialization and destroys it after rejection', async () => {
        const pending = deferred();
        const owned = renderer(vi.fn().mockReturnValue(pending.promise));
        selection.mockResolvedValue({ options: {}, renderer: owned });
        const app = new OwnedApplication();
        const initializing = app.init();
        const rejected = expect(initializing).rejects.toThrow('partial GPU failure');
        await vi.waitFor(() => expect(owned.init).toHaveBeenCalledTimes(1));
        expect(app.renderer).toBe(owned);
        pending.reject(new Error('partial GPU failure'));
        await rejected;
        expect(owned.destroy).toHaveBeenCalledExactlyOnceWith({ releaseGlobalResources: false, removeView: false });
        expect(app.stage.destroyed).toBe(true);
        app.destroy();
        expect(owned.destroy).toHaveBeenCalledTimes(1);
    });

    it.each(['resolve', 'reject'] as const)('defers retired teardown until pending renderer initialization %ss', async settlement => {
        const pending = deferred();
        const owned = renderer(vi.fn().mockReturnValue(pending.promise));
        const plugin = { destroy: vi.fn(), init: vi.fn() };
        Application._plugins = [plugin];
        selection.mockResolvedValue({ options: {}, renderer: owned });
        const app = new OwnedApplication();
        const initializing = app.init();
        const rejected = expect(initializing).rejects.toThrow(settlement === 'resolve' ? 'destroyed' : 'late failure');
        await vi.waitFor(() => expect(owned.init).toHaveBeenCalled());
        app.destroy(); app.destroy();
        expect(owned.destroy).not.toHaveBeenCalled();
        if (settlement === 'resolve') pending.resolve();
        else pending.reject(new Error('late failure'));
        await rejected;
        expect(plugin.init).not.toHaveBeenCalled();
        expect(plugin.destroy).not.toHaveBeenCalled();
        expect(owned.destroy).toHaveBeenCalledTimes(1);
    });

    it('disposes a constructed renderer if retirement wins the selection handoff', async () => {
        const owned = renderer();
        selection.mockResolvedValue({ options: {}, renderer: owned });
        const app = new OwnedApplication();
        const initializing = app.init();
        app.destroy();
        await expect(initializing).rejects.toThrow('destroyed');
        expect(owned.init).not.toHaveBeenCalled();
        expect(owned.destroy).toHaveBeenCalledTimes(1);
    });

    it('unwinds attempted plugins including the failing one, continues after destroy errors, and skips unreached plugins', async () => {
        const order: string[] = [];
        const plugin = (name: string, fails = false): ApplicationPlugin => ({
            destroy() { order.push(`destroy ${name}`); if (fails) throw new Error('plugin cleanup failed'); },
            init() { order.push(`init ${name}`); if (fails) throw new Error('plugin init failed'); },
        });
        Application._plugins = [plugin('first'), plugin('partial', true), plugin('unreached')];
        const owned = renderer();
        selection.mockResolvedValue({ options: {}, renderer: owned });
        const app = new OwnedApplication();
        const stageDestroy = vi.spyOn(app.stage, 'destroy');
        const failure = await app.init().catch(error => error as AggregateError) as AggregateError;
        expect(failure).toBeInstanceOf(AggregateError);
        expect(failure.errors.map((error: Error) => error.message)).toEqual(['plugin init failed', 'plugin cleanup failed']);
        expect(order).toEqual(['init first', 'init partial', 'destroy partial', 'destroy first']);
        expect(stageDestroy).toHaveBeenCalled();
        expect(owned.destroy).toHaveBeenCalledTimes(1);
        app.destroy();
        expect(owned.destroy).toHaveBeenCalledTimes(1);
    });

    it('uses a stopped private Pixi ticker and destroys its listeners on retirement', async () => {
        Application._plugins = [TickerPlugin];
        selection.mockResolvedValue({ options: {}, renderer: renderer() });
        const app = new OwnedApplication();
        await app.init({ autoStart: true, sharedTicker: true });
        const ticker = app.ticker;
        expect(ticker.started).toBe(false);
        expect(ticker.count).toBe(1);
        app.destroy();
        expect(ticker.started).toBe(false);
        expect(ticker.count).toBe(0);
        expect(app.ticker).toBeNull();
    });

    it('preserves a texture and source shared with a successor stage', async () => {
        selection.mockResolvedValue({ options: {}, renderer: renderer() });
        const old = new OwnedApplication();
        await old.init();
        const texture = new Texture();
        const textureDestroy = vi.spyOn(texture, 'destroy');
        const sourceDestroy = vi.spyOn(texture.source, 'destroy');
        old.stage.addChild(new Container()).addChild(new Sprite(texture));
        const current = new Sprite(texture);
        old.destroy();
        expect(textureDestroy).not.toHaveBeenCalled();
        expect(sourceDestroy).not.toHaveBeenCalled();
        expect(current.texture).toBe(texture);
        current.destroy();
        texture.destroy();
    });

    it('attempts later renderer participants and final cleanup despite an earlier destructor throwing', async () => {
        const owned = renderer();
        const order: string[] = [];
        owned.runners.destroy.items.push(
            { destroy: vi.fn(() => order.push('first')) },
            { destroy: vi.fn(() => { order.push('partial'); throw new Error('system cleanup failed'); }) },
        );
        owned.destroy.mockImplementation(() => { order.push('renderer'); expect(owned.runners.destroy.items).toHaveLength(0); });
        selection.mockResolvedValue({ options: {}, renderer: owned });
        const app = new OwnedApplication();
        await app.init();
        expect(() => app.destroy()).toThrow(AggregateError);
        expect(order).toEqual(['partial', 'first', 'renderer']);
        app.destroy();
        expect(owned.destroy).toHaveBeenCalledTimes(1);
    });

    it('retires a failed selection without destroying uninitialized plugins and rejects reinitialization', async () => {
        const plugin = { destroy: vi.fn(), init: vi.fn() };
        Application._plugins = [plugin];
        selection.mockRejectedValue(new Error('capability failure'));
        const app = new OwnedApplication();
        await expect(app.init()).rejects.toThrow('capability failure');
        app.destroy();
        await expect(app.init()).rejects.toThrow('destroyed');
        expect(plugin.destroy).not.toHaveBeenCalled();
        expect(app.stage.destroyed).toBe(true);
    });

    it('does not duplicate a successful initialization', async () => {
        const owned = renderer();
        selection.mockResolvedValue({ options: {}, renderer: owned as unknown as Renderer });
        const app = new OwnedApplication();
        await app.init();
        await expect(app.init()).rejects.toThrow('already started');
        expect(owned.init).toHaveBeenCalledTimes(1);
        app.destroy();
    });

    it('uses one plugin snapshot when initialization changes the global registry', async () => {
        const late = { destroy: vi.fn(), init: vi.fn() };
        Application._plugins = [{ destroy: vi.fn(), init: () => { Application._plugins.push(late); } }];
        selection.mockResolvedValue({ options: {}, renderer: renderer() });
        const app = new OwnedApplication();
        await app.init();
        app.destroy();
        expect(late.init).not.toHaveBeenCalled();
        expect(late.destroy).not.toHaveBeenCalled();
    });
});
