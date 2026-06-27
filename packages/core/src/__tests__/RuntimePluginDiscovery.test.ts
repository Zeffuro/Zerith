import { describe, expect, it, vi } from 'vitest';

import type { RegisteredRuntimePlugin, RuntimePlugin } from '../types/RuntimePlugin';

import {
    discoverRuntimePluginCandidates,
    loadDiscoveredRuntimePlugins,
    parseRuntimePluginManifest,
} from '../utils/RuntimePluginDiscovery';

describe('RuntimePluginDiscovery', () => {
    it('normalizes valid runtime plugin manifests', () => {
        const parsed = parseRuntimePluginManifest({
            capabilities: ['overlays', 'commands', 'commands'],
            engineVersion: ' >=0.1.0 ',
            id: ' runtime.plugin ',
            name: ' Runtime Plugin ',
            pluginApiVersion: 1,
            version: ' 0.1.0 ',
        });

        expect(parsed).toEqual({
            manifest: {
                capabilities: ['commands', 'overlays'],
                engineVersion: '>=0.1.0',
                id: 'runtime.plugin',
                name: 'Runtime Plugin',
                pluginApiVersion: 1,
                version: '0.1.0',
            },
            ok: true,
        });
    });

    it('rejects invalid candidates without loading plugin modules', () => {
        const incompatibleLoad = vi.fn();
        const unknownCapabilityLoad = vi.fn();
        const result = discoverRuntimePluginCandidates([
            {
                load: incompatibleLoad,
                manifest: {
                    id: 'future.runtime',
                    name: 'Future Runtime',
                    pluginApiVersion: 999,
                    version: '1.0.0',
                },
                source: '/plugins/future/runtime.json',
            },
            {
                load: unknownCapabilityLoad,
                manifest: {
                    capabilities: ['inspectors'],
                    id: 'bad.capability',
                    name: 'Bad Capability',
                    version: '1.0.0',
                },
                source: '/plugins/bad/runtime.json',
            },
        ]);

        expect(result.discovered).toEqual([]);
        expect(result.rejected.map((entry) => entry.reason)).toEqual([
            "unknown capability 'inspectors'",
            'targets plugin API v999, but this runtime supports v1',
        ]);
        expect(incompatibleLoad).not.toHaveBeenCalled();
        expect(unknownCapabilityLoad).not.toHaveBeenCalled();
    });

    it('loads discovered runtime plugins and registers matching contributions', async () => {
        const plugin: RuntimePlugin = {
            activate: vi.fn(),
            manifest: {
                capabilities: ['commands'],
                id: 'runtime.signal',
                name: 'Runtime Signal',
                pluginApiVersion: 1,
                version: '1.0.0',
            },
        };
        const registered: RegisteredRuntimePlugin = {
            active: true,
            capabilities: ['commands'],
            manifest: plugin.manifest,
        };
        const register = vi.fn(() => Promise.resolve(registered));

        const result = await loadDiscoveredRuntimePlugins([
            {
                load: () => plugin,
                manifest: plugin.manifest,
                source: '/plugins/runtime-signal/plugin.json',
            },
        ], register);

        expect(result).toEqual({
            registered: [registered],
            rejected: [],
        });
        expect(register).toHaveBeenCalledWith(plugin);
    });

    it('rejects loaded runtime plugins whose manifest differs from the sidecar', async () => {
        const register = vi.fn();
        const result = await loadDiscoveredRuntimePlugins([
            {
                load: () => ({
                    activate: vi.fn(),
                    manifest: {
                        id: 'other.runtime',
                        name: 'Other Runtime',
                        version: '1.0.0',
                    },
                }),
                manifest: {
                    id: 'expected.runtime',
                    name: 'Expected Runtime',
                    version: '1.0.0',
                },
                source: '/plugins/expected/runtime.json',
            },
        ], register);

        expect(result.registered).toEqual([]);
        expect(result.rejected).toEqual([
            {
                manifestId: 'expected.runtime',
                reason: "loaded plugin id 'other.runtime' does not match discovered id 'expected.runtime'",
                source: '/plugins/expected/runtime.json',
            },
        ]);
        expect(register).not.toHaveBeenCalled();
    });
});
