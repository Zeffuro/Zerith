import { SchemaRegistry, ScriptSchema } from '@zeffuro/zerith-core/schemas';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import type { EditorPluginContribution, PluginAPI } from '../types';

import { loadDiscoveredEditorPlugins } from '../pluginDiscovery';

let registry: typeof import('../commandPlugins');
const manifest = (id: string) => ({ id, name: id, version: '1.0.0' });
const candidate = (contribution: EditorPluginContribution, load = vi.fn(() => contribution)) => ({
    load, manifest: contribution.manifest, source: `/plugins/${contribution.manifest.id}/source.json`,
});

describe('editor plugin lifecycle', () => {
    beforeAll(async () => {
        vi.stubGlobal('document', { createElement: () => ({ canPlayType: () => 'probably' }) });
        vi.stubGlobal('window', {});
        registry = await import('../commandPlugins');
    });
    afterAll(() => vi.unstubAllGlobals());

    it('rejects active duplicate loads before evaluating and explicitly reloads an inactive plugin', async () => {
        const activate = vi.fn();
        const plugin = candidate({ activate, manifest: manifest('lifecycle.reload') });
        const initial = await loadDiscoveredEditorPlugins([plugin], registry.registerEditorPlugin);
        const duplicate = await loadDiscoveredEditorPlugins([plugin], registry.registerEditorPlugin);
        expect(initial.registered).toHaveLength(1);
        expect(duplicate.rejected).toHaveLength(1);
        expect(plugin.load).toHaveBeenCalledTimes(1);
        expect(activate).toHaveBeenCalledTimes(1);
        registry.deactivateEditorPlugin(plugin.manifest.id);
        const reload = await loadDiscoveredEditorPlugins([plugin], registry.registerEditorPlugin);
        expect(reload.registered).toHaveLength(1);
        expect(plugin.load).toHaveBeenCalledTimes(2);
        expect(activate).toHaveBeenCalledTimes(2);
    });

    it('reserves a loading id across concurrent requests and releases it after module failure', async () => {
        const contribution = { manifest: manifest('lifecycle.concurrent') };
        let rejectLoad!: (error: Error) => void;
        const load = vi.fn(() => new Promise<EditorPluginContribution>((_, reject) => { rejectLoad = reject; }));
        const plugin = { load, manifest: contribution.manifest, source: '/plugins/concurrent' };
        const first = loadDiscoveredEditorPlugins([plugin], registry.registerEditorPlugin);
        const second = await loadDiscoveredEditorPlugins([candidate(contribution)], registry.registerEditorPlugin);
        rejectLoad(new Error('module failed'));
        const failed = await first;
        expect(failed.rejected[0].reason).toContain('module failed');
        expect(second.registered).toHaveLength(0);
        expect(second.rejected).toHaveLength(1);
        const retry = await loadDiscoveredEditorPlugins([candidate(contribution)], registry.registerEditorPlugin);
        expect(retry.registered).toHaveLength(1);
    });

    it('removes owned behavior and schemas while retaining saved node fields and unrelated commands', () => {
        const type = 'lifecycle_owned';
        const otherType = 'lifecycle_other';
        const builtIn = registry.getPlugin('dialogue');
        registry.registerEditorPlugin({ commands: [{ label: 'Other', type: otherType }], manifest: manifest('lifecycle.other') });
        const other = registry.getPlugin(otherType);
        registry.registerEditorPlugin({
            commands: [{
                createDefault: () => ({ amount: 5, type }),
                getSummary: () => 'Custom behavior', label: 'Owned behavior',
                schema: z.object({ amount: z.number(), type: z.literal(type) }), type,
            }],
            manifest: manifest('lifecycle.owned'),
        });
        const saved = { amount: 8, extension: { preserved: true }, type };
        registry.deactivateEditorPlugin('lifecycle.owned');
        expect(registry.getAllPlugins().map(plugin => plugin.type)).not.toContain(type);
        expect(registry.getPlugin(type).getSummary).toBeUndefined();
        expect(registry.createDefaultCommand(type)).toEqual({ type });
        expect(SchemaRegistry.get(type)).toBeUndefined();
        expect(ScriptSchema.parse([saved])).toEqual([saved]);
        expect(registry.getPlugin(otherType)).toBe(other);
        expect(registry.getPlugin('dialogue')).toBe(builtIn);
    });

    it('owns activation-time and later scoped commands and closes old APIs on reload', () => {
        let api!: PluginAPI;
        const contribution = {
            activate: (scoped: PluginAPI) => { api = scoped; scoped.registerCommandPlugin({ type: 'lifecycle_dynamic' }); },
            manifest: manifest('lifecycle.dynamic'),
        };
        registry.registerEditorPlugin(contribution);
        api.registerCommandPlugin({ type: 'lifecycle_later' });
        expect(registry.getRegisteredEditorPlugins().find(plugin => plugin.manifest.id === contribution.manifest.id)?.commandTypes)
            .toEqual(['lifecycle_dynamic', 'lifecycle_later']);
        const staleApi = api;
        registry.deactivateEditorPlugin(contribution.manifest.id);
        expect(registry.getAllPlugins().map(plugin => plugin.type)).not.toContain('lifecycle_later');
        expect(() => staleApi.registerCommandPlugin({ type: 'lifecycle_zombie' })).toThrow();
        expect(() => staleApi.registerPlugin({ manifest: manifest('lifecycle.zombie') })).toThrow();
        registry.registerEditorPlugin(contribution);
        expect(() => staleApi.registerCommandPlugin({ type: 'lifecycle_dynamic' })).toThrow();
        expect(registry.getAllPlugins().map(plugin => plugin.type)).not.toContain('lifecycle_zombie');
    });

    it.each(['dialogue', 'lifecycle_other', 'lifecycle_direct'])('rejects command collisions with %s and rolls back partial registration', type => {
        if (type === 'lifecycle_direct') registry.registerCommandPlugin({ label: 'Direct', type });
        const original = registry.getPlugin(type);
        const originalSchema = SchemaRegistry.get(type);
        expect(() => registry.registerEditorPlugin({
            commands: [{ type: `partial_${type}` }, { label: 'Replacement', type }],
            manifest: manifest(`collision.${type}`),
        })).toThrow();
        expect(registry.getPlugin(type)).toBe(original);
        expect(SchemaRegistry.get(type)).toBe(originalSchema);
        expect(registry.getAllPlugins().map(plugin => plugin.type)).not.toContain(`partial_${type}`);
    });

    it('rolls back failed activation, invokes deactivation and allows a clean retry', () => {
        const type = 'lifecycle_failure';
        const deactivate = vi.fn();
        const contribution = {
            activate: (api: PluginAPI) => {
                api.registerCommandPlugin({ type: 'lifecycle_failure_dynamic' });
                throw new Error('activation failed');
            },
            commands: [{ schema: z.object({ type: z.literal(type) }), type }],
            deactivate, manifest: manifest('lifecycle.failure'),
        };
        expect(() => registry.registerEditorPlugin(contribution)).toThrow('activation failed');
        expect(SchemaRegistry.get(type)).toBeUndefined();
        expect(registry.getAllPlugins().map(plugin => plugin.type)).not.toContain('lifecycle_failure_dynamic');
        expect(registry.getRegisteredEditorPlugins().find(plugin => plugin.manifest.id === contribution.manifest.id)).toBeUndefined();
        expect(deactivate).toHaveBeenCalledOnce();
        expect(registry.registerEditorPlugin({ ...contribution, activate: undefined }).active).toBe(true);
    });

    it('runs both teardown hooks once despite errors and blocks reentrant reload until they finish', () => {
        const id = 'lifecycle.teardown';
        const reload = { manifest: manifest(id) };
        const deactivate = vi.fn(() => { throw new Error('deactivate failed'); });
        const cleanup = vi.fn(() => {
            expect(registry.deactivateEditorPlugin(id)).toBe(false);
            expect(() => registry.registerEditorPlugin(reload)).toThrow();
            throw new Error('cleanup failed');
        });
        registry.registerEditorPlugin({ activate: () => cleanup, commands: [{ type: id }], deactivate, manifest: manifest(id) });
        expect(() => registry.deactivateEditorPlugin(id)).toThrow(/cleanup failed/);
        expect(cleanup).toHaveBeenCalledOnce();
        expect(deactivate).toHaveBeenCalledOnce();
        expect(registry.deactivateEditorPlugin(id)).toBe(false);
        expect(registry.getAllPlugins().map(plugin => plugin.type)).not.toContain(id);
        expect(registry.registerEditorPlugin(reload).active).toBe(true);
    });

    it('blocks direct writes to an owned command and same-id reentrant activation', () => {
        const id = 'lifecycle.reentrant';
        const contribution = { manifest: manifest(id) };
        registry.registerEditorPlugin({
            ...contribution,
            activate: () => { expect(() => registry.registerEditorPlugin(contribution)).toThrow(); },
            commands: [{ label: 'Original', type: id }],
        });
        expect(() => registry.registerCommandPlugin({ label: 'Overwrite', type: id })).toThrow();
        expect(registry.getPlugin(id).label).toBe('Original');
    });

    it('rejects asynchronous activation and teardown without leaking registrations or rejected promises', async () => {
        const id = 'lifecycle.async';
        const deactivate = vi.fn(() => Promise.reject(new Error('async deactivation failed')));
        const activate = vi.fn(() => Promise.reject(new Error('async activation failed')));
        expect(() => registry.registerEditorPlugin({
            activate: activate as unknown as EditorPluginContribution['activate'],
            // Installed JavaScript can supply promise-returning hooks despite the API contract.
            // eslint-disable-next-line @typescript-eslint/no-misused-promises
            commands: [{ type: id }], deactivate, manifest: manifest(id),
        })).toThrow('activation must be synchronous');
        expect(deactivate).toHaveBeenCalledOnce();
        expect(registry.getAllPlugins().map(plugin => plugin.type)).not.toContain(id);
        const cleanup = vi.fn(() => Promise.reject(new Error('async cleanup failed')));
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        registry.registerEditorPlugin({ activate: () => cleanup, deactivate, manifest: manifest(id) });
        expect(() => registry.deactivateEditorPlugin(id)).toThrow('must be synchronous');
        expect(cleanup).toHaveBeenCalledOnce();
        expect(deactivate).toHaveBeenCalledTimes(2);
        expect(registry.deactivateEditorPlugin(id)).toBe(false);
        await Promise.resolve();
    });

    it('releases reservations after manifest mismatch and preserves inactive state after a failed reload', async () => {
        const id = 'lifecycle.retry';
        const contribution = { commands: [{ type: id }], manifest: manifest(id) };
        const mismatch = await loadDiscoveredEditorPlugins([
            { ...candidate(contribution), load: () => ({ manifest: manifest('other.id') }) },
        ], registry.registerEditorPlugin);
        expect(mismatch.rejected[0].reason).toContain('does not match');
        const initial = await loadDiscoveredEditorPlugins([candidate(contribution)], registry.pluginApi.registerPlugin);
        expect(initial.registered).toHaveLength(1);
        const duplicate = candidate(contribution);
        await loadDiscoveredEditorPlugins([duplicate], registry.pluginApi.registerPlugin);
        expect(duplicate.load).not.toHaveBeenCalled();
        registry.deactivateEditorPlugin(id);
        const failed = await loadDiscoveredEditorPlugins([
            candidate({ ...contribution, activate: () => { throw new Error('failed reload'); } }),
        ], registry.registerEditorPlugin);
        expect(failed.rejected[0].reason).toContain('failed reload');
        expect(registry.getRegisteredEditorPlugins().find(plugin => plugin.manifest.id === id)?.active).toBe(false);
        expect(registry.getAllPlugins().map(plugin => plugin.type)).not.toContain(id);
        const retry = await loadDiscoveredEditorPlugins([candidate(contribution)], registry.registerEditorPlugin);
        expect(retry.registered).toHaveLength(1);
    });
});
