import { describe, expect, it, vi } from 'vitest';

import type { RuntimePluginCleanup, RuntimePluginContext } from '../types';

import { deferred, pluginHandler, pluginManifest, pluginPanel, runtimePluginHarness } from '../test-utils/runtimePluginHarness';

describe('runtime plugin ownership', () => {
    it.each(['AB', 'BA'])('restores a live default after unloading overrides in %s order', async order => {
        const { engine } = runtimePluginHarness();
        const base = pluginHandler();
        const handlers = { A: pluginHandler(), B: pluginHandler() };
        engine.registerHandler(base);
        for (const id of ['A', 'B'] as const) await engine.registerPlugin({ activate: context => { context.registerHandler(handlers[id]); }, manifest: pluginManifest(id) });
        await engine.deactivatePlugin(order[0]);
        expect(engine.getHandler('marker')).toBe(order === 'AB' ? handlers.B : handlers.A);
        await engine.deactivatePlugin(order[1]);
        expect(engine.getHandler('marker')).toBe(base);
        expect(base.destroy).not.toHaveBeenCalled();
        for (const handler of Object.values(handlers)) expect(handler.destroy).toHaveBeenCalledOnce();
    });

    it('reserves a normalized ID before asynchronous activation', async () => {
        const { engine } = runtimePluginHarness();
        const gate = deferred<RuntimePluginCleanup>();
        const activate = vi.fn(() => gate.promise);
        const cleanup = vi.fn();
        const first = engine.registerPlugin({ activate, manifest: pluginManifest(' duplicate ') });
        await expect(engine.registerPlugin({ activate, manifest: pluginManifest('duplicate') })).rejects.toThrow(/already registered/);
        gate.resolve(cleanup);
        await first;
        expect(activate).toHaveBeenCalledOnce();
        await engine.deactivatePlugin('duplicate');
        expect(cleanup).toHaveBeenCalledOnce();
    });

    it.each(['ABC', 'ACB', 'BAC', 'BCA', 'CAB', 'CBA'])('disposes every handler once in %s order without a default', async order => {
        const { engine } = runtimePluginHarness();
        const handlers = new Map([...order].map(id => [id, pluginHandler()]));
        for (const id of ['A', 'B', 'C']) await engine.registerPlugin({ activate: context => { context.registerHandler(handlers.get(id)!); }, manifest: pluginManifest(id) });
        const live = new Set(['A', 'B', 'C']);
        for (const id of order) {
            await engine.deactivatePlugin(id);
            live.delete(id);
            expect(engine.getHandler('marker')).toBe(handlers.get(['A', 'B', 'C'].findLast(candidate => live.has(candidate)) ?? ''));
        }
        for (const handler of handlers.values()) expect(handler.destroy).toHaveBeenCalledOnce();
    });

    it('does not replace an unrelated handler registered over a plugin', async () => {
        const { engine } = runtimePluginHarness();
        const owned = pluginHandler();
        const external = pluginHandler();
        await engine.registerPlugin({ activate: context => { context.registerHandler(owned); }, manifest: pluginManifest('A') });
        engine.registerHandler(external);
        await engine.deactivatePlugin('A');
        expect(engine.getHandler('marker')).toBe(external);
        expect(owned.destroy).toHaveBeenCalledOnce();
        expect(external.destroy).not.toHaveBeenCalled();
    });

    it('restores an external replacement captured between plugin layers', async () => {
        const { engine } = runtimePluginHarness();
        const first = pluginHandler();
        const external = pluginHandler();
        const second = pluginHandler();
        await engine.registerPlugin({ activate: context => { context.registerHandler(first); }, manifest: pluginManifest('A') });
        engine.registerHandler(external);
        await engine.registerPlugin({ activate: context => { context.registerHandler(second); }, manifest: pluginManifest('B') });
        await engine.deactivatePlugin('A');
        await engine.deactivatePlugin('B');
        expect(engine.getHandler('marker')).toBe(external);
        expect(first.destroy).toHaveBeenCalledOnce();
        expect(second.destroy).toHaveBeenCalledOnce();
    });

    it('revokes and detaches contributions before awaiting a deactivate hook', async () => {
        const { engine, panels } = runtimePluginHarness();
        const gate = deferred();
        const handler = pluginHandler();
        let context!: RuntimePluginContext;
        await engine.registerPlugin({ activate: api => { context = api; api.registerHandler(handler); api.registerPanel(pluginPanel()); }, deactivate: () => gate.promise, manifest: pluginManifest('A') });
        const removing = engine.deactivatePlugin('A');
        expect(engine.getHandler('marker')).toBeUndefined();
        expect(panels.size).toBe(0);
        expect(engine.getRegisteredPlugins()).toEqual([]);
        expect(() => context.registerHandler(pluginHandler())).toThrow(/inactive|cancelled|closed/);
        expect(() => context.registerPanel(pluginPanel('late'))).toThrow(/inactive|cancelled|closed/);
        gate.resolve();
        await removing;
        expect(handler.destroy).toHaveBeenCalledOnce();
    });

    it('rolls back a failed activation, revokes its context and permits retry', async () => {
        const { engine, panels } = runtimePluginHarness();
        const handler = pluginHandler();
        let context!: RuntimePluginContext;
        const plugin = { activate: (api: RuntimePluginContext) => {
            context = api;
            api.registerHandler(handler);
            api.registerPanel(pluginPanel());
            throw new Error('activation failed');
        }, manifest: pluginManifest('A') };
        await expect(engine.registerPlugin(plugin)).rejects.toThrow('activation failed');
        expect(engine.getHandler('marker')).toBeUndefined();
        expect(panels.size).toBe(0);
        expect(handler.destroy).toHaveBeenCalledOnce();
        expect(() => context.registerHandler(pluginHandler())).toThrow();
        await engine.registerPlugin({ activate: vi.fn(), manifest: pluginManifest('A') });
        expect(engine.getRegisteredPlugins()).toHaveLength(1);
        await engine.deactivatePlugin('A');
    });

    it('cancels pending activation promptly and disposes its later returned cleanup once', async () => {
        const { engine } = runtimePluginHarness();
        const gate = deferred<RuntimePluginCleanup>();
        const handler = pluginHandler();
        const cleanup = vi.fn();
        const deactivate = vi.fn();
        let context!: RuntimePluginContext;
        const registration = engine.registerPlugin({ activate: api => { context = api; api.registerHandler(handler); return gate.promise; }, deactivate, manifest: pluginManifest('A') });
        await expect(engine.deactivatePlugin('A')).resolves.toBe(true);
        expect(engine.getHandler('marker')).toBeUndefined();
        expect(handler.destroy).toHaveBeenCalledOnce();
        expect(() => context.registerPanel(pluginPanel())).toThrow();
        await expect(engine.registerPlugin({ activate: vi.fn(), manifest: pluginManifest('A') })).rejects.toThrow(/already registered/);
        const cancelled = expect(registration).rejects.toThrow(/cancelled/);
        gate.resolve(cleanup);
        await cancelled;
        expect(deactivate).toHaveBeenCalledOnce();
        expect(cleanup).toHaveBeenCalledOnce();
        expect(handler.destroy).toHaveBeenCalledOnce();
        expect(engine.getRegisteredPlugins()).toEqual([]);
        await engine.registerPlugin({ activate: vi.fn(), manifest: pluginManifest('A') });
        await engine.deactivatePlugin('A');
    });

    it('does not leak a cancelled activation that later rejects', async () => {
        const { engine, panels } = runtimePluginHarness();
        const gate = deferred();
        const handler = pluginHandler();
        const deactivate = vi.fn();
        const registration = engine.registerPlugin({ activate: context => { context.registerHandler(handler); context.registerPanel(pluginPanel()); return gate.promise; }, deactivate, manifest: pluginManifest('A') });
        await engine.deactivatePlugin('A');
        const failed = expect(registration).rejects.toThrow('late failure');
        gate.reject(new Error('late failure'));
        await failed;
        expect(handler.destroy).toHaveBeenCalledOnce();
        expect(deactivate).not.toHaveBeenCalled();
        expect(panels.size).toBe(0);
        await engine.registerPlugin({ activate: vi.fn(), manifest: pluginManifest('A') });
        await engine.deactivatePlugin('A');
    });

    it('awaits an already-started manual disposer without destroying twice', async () => {
        const { engine } = runtimePluginHarness();
        const gate = deferred();
        const handler = pluginHandler();
        handler.destroy.mockReturnValue(gate.promise);
        let dispose!: RuntimePluginCleanup;
        await engine.registerPlugin({ activate: context => { dispose = context.registerHandler(handler); }, manifest: pluginManifest('A') });
        const first = dispose();
        expect(dispose()).toBe(first);
        let removed = false;
        const removing = engine.deactivatePlugin('A').then(() => { removed = true; });
        await Promise.resolve();
        expect(removed).toBe(false);
        gate.resolve();
        await removing;
        expect(handler.destroy).toHaveBeenCalledOnce();
        expect(engine.getHandler('marker')).toBeUndefined();
    });

    it('keeps the ID reserved throughout asynchronous cleanup', async () => {
        const { engine } = runtimePluginHarness();
        const gate = deferred();
        const cleanup = () => gate.promise;
        await engine.registerPlugin({ activate: () => cleanup, manifest: pluginManifest('A') });
        const removing = engine.deactivatePlugin('A');
        await expect(engine.registerPlugin({ activate: vi.fn(), manifest: pluginManifest('A') })).rejects.toThrow(/already registered/);
        gate.resolve();
        await removing;
        await engine.registerPlugin({ activate: vi.fn(), manifest: pluginManifest('A') });
        await engine.deactivatePlugin('A');
    });

    it('continues cleanup when hooks and async handler disposal reject', async () => {
        const { engine, logger, panels } = runtimePluginHarness();
        const first = pluginHandler('first');
        const second = pluginHandler('second');
        first.destroy.mockRejectedValue(new Error('handler failed'));
        const cleanup = vi.fn(() => { throw new Error('cleanup failed'); });
        const deactivate = vi.fn(() => Promise.reject(new Error('deactivate failed')));
        const error = vi.spyOn(logger, 'error');
        await engine.registerPlugin({ activate: context => {
            context.registerHandler(first);
            context.registerHandler(second);
            context.registerPanel(pluginPanel());
            return cleanup;
        }, deactivate, manifest: pluginManifest('A') });
        await expect(engine.deactivatePlugin('A')).resolves.toBe(true);
        expect(engine.getHandler('first')).toBeUndefined();
        expect(engine.getHandler('second')).toBeUndefined();
        expect(first.destroy).toHaveBeenCalledOnce();
        expect(second.destroy).toHaveBeenCalledOnce();
        expect(cleanup).toHaveBeenCalledOnce();
        expect(deactivate).toHaveBeenCalledOnce();
        expect(panels.size).toBe(0);
        expect(error).toHaveBeenCalledTimes(3);
        await expect(engine.deactivatePlugin('A')).resolves.toBe(false);
    });

    it('captures the registered command type for later disposal', async () => {
        const { engine } = runtimePluginHarness();
        const handler = pluginHandler();
        await engine.registerPlugin({ activate: context => { context.registerHandler(handler); }, manifest: pluginManifest('A') });
        handler.type = 'mutated';
        await engine.deactivatePlugin('A');
        expect(engine.getHandler('marker')).toBeUndefined();
        expect(handler.destroy).toHaveBeenCalledOnce();
    });

    it.each([false, true])('skips a mutated predecessor with a default: %s', async hasDefault => {
        const { engine } = runtimePluginHarness();
        const base = pluginHandler();
        const first = pluginHandler();
        const second = pluginHandler();
        if (hasDefault) engine.registerHandler(base);
        await engine.registerPlugin({ activate: context => { context.registerHandler(first); }, manifest: pluginManifest('A') });
        await engine.registerPlugin({ activate: context => { context.registerHandler(second); }, manifest: pluginManifest('B') });
        first.type = 'mutated';
        await engine.deactivatePlugin('B');
        expect(engine.getHandler('marker')).toBe(hasDefault ? base : undefined);
        expect(engine.getHandler('mutated')).toBeUndefined();
        await engine.deactivatePlugin('A');
        expect(engine.getHandler('marker')).toBe(hasDefault ? base : undefined);
        expect(first.destroy).toHaveBeenCalledOnce();
        expect(second.destroy).toHaveBeenCalledOnce();
        expect(base.destroy).not.toHaveBeenCalled();
    });

    it('never restores a captured base whose plugin owner was destroyed', async () => {
        const { engine } = runtimePluginHarness();
        const first = pluginHandler();
        const external = pluginHandler();
        const second = pluginHandler();
        const third = pluginHandler();
        await engine.registerPlugin({ activate: context => { context.registerHandler(first); }, manifest: pluginManifest('A') });
        engine.registerHandler(external);
        await engine.registerPlugin({ activate: context => { context.registerHandler(second); }, manifest: pluginManifest('B') });
        engine.registerHandler(first);
        await engine.registerPlugin({ activate: context => { context.registerHandler(third); }, manifest: pluginManifest('C') });
        await engine.deactivatePlugin('A');
        expect(first.destroy).toHaveBeenCalledOnce();
        await engine.deactivatePlugin('C');
        expect(engine.getHandler('marker')).toBeUndefined();
        await engine.deactivatePlugin('B');
        expect(engine.getHandler('marker')).toBeUndefined();
        for (const handler of [first, second, third]) expect(handler.destroy).toHaveBeenCalledOnce();
    });

    it('destroys a shared handler only after its last live contribution is removed', async () => {
        const { engine } = runtimePluginHarness();
        const handler = pluginHandler();
        for (const id of ['A', 'B']) await engine.registerPlugin({ activate: context => { context.registerHandler(handler); }, manifest: pluginManifest(id) });
        await engine.deactivatePlugin('A');
        expect(engine.getHandler('marker')).toBe(handler);
        expect(handler.destroy).not.toHaveBeenCalled();
        await engine.deactivatePlugin('B');
        expect(engine.getHandler('marker')).toBeUndefined();
        expect(handler.destroy).toHaveBeenCalledOnce();
    });

    it('detaches a shared mutated handler without destroying its remaining owner', async () => {
        const { engine } = runtimePluginHarness();
        const handler = pluginHandler();
        for (const id of ['A', 'B']) await engine.registerPlugin({ activate: context => { context.registerHandler(handler); }, manifest: pluginManifest(id) });
        handler.type = 'mutated';
        await engine.deactivatePlugin('B');
        expect(engine.getHandler('marker')).toBeUndefined();
        expect(engine.getHandler('mutated')).toBeUndefined();
        expect(handler.destroy).not.toHaveBeenCalled();
        await engine.deactivatePlugin('A');
        expect(handler.destroy).toHaveBeenCalledOnce();
    });

    it('does not destroy a borrowed default instance registered by a plugin', async () => {
        const { engine } = runtimePluginHarness();
        const base = pluginHandler();
        engine.registerHandler(base);
        await engine.registerPlugin({ activate: context => { context.registerHandler(base); }, manifest: pluginManifest('A') });
        await engine.deactivatePlugin('A');
        expect(engine.getHandler('marker')).toBe(base);
        expect(base.destroy).not.toHaveBeenCalled();
        engine.destroy();
        expect(base.destroy).toHaveBeenCalledOnce();
    });

    it('rolls back when reading the activation cleanup fails', async () => {
        const { engine } = runtimePluginHarness();
        const handler = pluginHandler();
        await expect(engine.registerPlugin({ activate: context => {
            context.registerHandler(handler);
            return { get cleanup(): RuntimePluginCleanup { throw new Error('cleanup getter failed'); } };
        }, manifest: pluginManifest('A') })).rejects.toThrow('cleanup getter failed');
        expect(engine.getHandler('marker')).toBeUndefined();
        expect(handler.destroy).toHaveBeenCalledOnce();
        await engine.registerPlugin({ activate: vi.fn(), manifest: pluginManifest('A') });
        await engine.deactivatePlugin('A');
    });

    it('allows an activation to await its own cancellation without deadlocking', async () => {
        const { engine } = runtimePluginHarness();
        const handler = pluginHandler();
        const cleanup = vi.fn();
        await expect(engine.registerPlugin({ activate: async context => {
            context.registerHandler(handler);
            await engine.deactivatePlugin('A');
            return cleanup;
        }, manifest: pluginManifest('A') })).rejects.toThrow(/cancelled/);
        expect(handler.destroy).toHaveBeenCalledOnce();
        expect(cleanup).toHaveBeenCalledOnce();
    });

    it('does not let returned metadata change registry ownership', async () => {
        const { engine } = runtimePluginHarness();
        const registered = await engine.registerPlugin({ activate: vi.fn(), manifest: pluginManifest('A') });
        registered.manifest.id = 'changed';
        registered.manifest.capabilities?.push('events');
        expect(engine.getRegisteredPlugins()[0].manifest.id).toBe('A');
        expect(engine.getRegisteredPlugins()[0].manifest.capabilities).not.toContain('events');
        await engine.deactivatePlugin('A');
    });

    it('preserves a pre-existing panel when a plugin registers the same ID', async () => {
        const { engine, panels } = runtimePluginHarness();
        const base = pluginPanel();
        engine.registerDefaultPanels([base]);
        await engine.registerPlugin({ activate: context => { context.registerPanel(pluginPanel()); }, manifest: pluginManifest('A') });
        await engine.deactivatePlugin('A');
        expect(panels.get('panel')).toBe(base);
    });

    it('revokes every context and destroys layered handlers once on repeated engine destroy', async () => {
        const { engine, flow, panels } = runtimePluginHarness();
        const base = pluginHandler();
        const handlers = [pluginHandler(), pluginHandler()];
        const contexts: RuntimePluginContext[] = [];
        const cleanup = [vi.fn(), vi.fn()];
        const gate = deferred();
        engine.registerHandler(base);
        for (const [index, handler] of handlers.entries()) await engine.registerPlugin({ activate: context => {
            contexts.push(context);
            context.registerHandler(handler);
            context.registerPanel(pluginPanel(String(index)));
            return cleanup[index];
        }, deactivate: index === 0 ? () => gate.promise : vi.fn(), manifest: pluginManifest(String(index)) });
        engine.destroy();
        engine.destroy();
        expect(engine.getHandler('marker')).toBeUndefined();
        expect(panels.size).toBe(0);
        for (const context of contexts) expect(() => context.registerHandler(pluginHandler())).toThrow();
        gate.resolve();
        await vi.waitFor(() => { for (const task of cleanup) expect(task).toHaveBeenCalledOnce(); });
        for (const handler of [base, ...handlers]) expect(handler.destroy).toHaveBeenCalledOnce();
        flow.destroyHandlers();
        expect(base.destroy).toHaveBeenCalledOnce();
        expect(engine.getRegisteredPlugins()).toEqual([]);
    });

    it('disposes pending activation after destroy and rejects new activation', async () => {
        const { engine } = runtimePluginHarness();
        const gate = deferred<RuntimePluginCleanup>();
        const handler = pluginHandler();
        const cleanup = vi.fn();
        let context!: RuntimePluginContext;
        const registration = engine.registerPlugin({ activate: api => { context = api; api.registerHandler(handler); return gate.promise; }, manifest: pluginManifest('A') });
        engine.destroy();
        expect(engine.getHandler('marker')).toBeUndefined();
        expect(() => context.registerHandler(pluginHandler())).toThrow();
        await expect(engine.registerPlugin({ activate: vi.fn(), manifest: pluginManifest('new') })).rejects.toThrow(/destroyed/);
        const cancelled = expect(registration).rejects.toThrow(/cancelled/);
        gate.resolve(cleanup);
        await cancelled;
        expect(cleanup).toHaveBeenCalledOnce();
        expect(handler.destroy).toHaveBeenCalledOnce();
        expect(engine.getRegisteredPlugins()).toEqual([]);
    });
});
