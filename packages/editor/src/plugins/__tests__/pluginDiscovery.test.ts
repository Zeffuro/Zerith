import { describe, expect, it, vi } from 'vitest';

import type { EditorPluginContribution, RegisteredEditorPlugin } from '../types';

import {
    discoverEditorPluginCandidates,
    loadDiscoveredEditorPlugins,
    parseEditorPluginManifest,
} from '../pluginDiscovery';

describe('pluginDiscovery', () => {
    it('normalizes valid editor plugin manifests', () => {
        const parsed = parseEditorPluginManifest({
            capabilities: ['validators', 'commands', 'commands'],
            description: ' Test plugin ',
            entry: './dist/index.js',
            id: ' example.plugin ',
            name: ' Example Plugin ',
            pluginApiVersion: 1,
            version: ' 0.1.0 ',
        });

        expect(parsed).toEqual({
            manifest: {
                capabilities: ['commands', 'validators'],
                description: 'Test plugin',
                entry: 'dist/index.js',
                id: 'example.plugin',
                name: 'Example Plugin',
                pluginApiVersion: 1,
                version: '0.1.0',
            },
            ok: true,
        });
    });

    it('rejects plugin entry paths outside the package', () => {
        expect(parseEditorPluginManifest({
            entry: '../outside.js',
            id: 'unsafe.entry',
            name: 'Unsafe Entry',
            version: '1.0.0',
        })).toEqual({
            ok: false,
            reason: 'entry must be a relative path inside the plugin package',
        });

        expect(parseEditorPluginManifest({
            entry: 'https://example.test/plugin.js',
            id: 'remote.entry',
            name: 'Remote Entry',
            version: '1.0.0',
        })).toEqual({
            ok: false,
            reason: 'entry must be a relative path inside the plugin package',
        });
    });

    it('rejects invalid capabilities and incompatible plugin API versions during discovery', () => {
        const incompatibleLoad = vi.fn();
        const unknownCapabilityLoad = vi.fn();
        const result = discoverEditorPluginCandidates([
            {
                load: incompatibleLoad,
                manifest: {
                    id: 'future.plugin',
                    name: 'Future Plugin',
                    pluginApiVersion: 999,
                    version: '1.0.0',
                },
                source: '/plugins/future/plugin.json',
            },
            {
                load: unknownCapabilityLoad,
                manifest: {
                    capabilities: ['unknown'],
                    id: 'unknown.capability',
                    name: 'Unknown Capability',
                    version: '1.0.0',
                },
                source: '/plugins/unknown/plugin.json',
            },
        ]);

        expect(result.discovered).toEqual([]);
        expect(result.rejected.map((entry) => entry.reason)).toEqual([
            'targets plugin API v999, but this editor supports v1',
            "unknown capability 'unknown'",
        ]);
        expect(incompatibleLoad).not.toHaveBeenCalled();
        expect(unknownCapabilityLoad).not.toHaveBeenCalled();
    });

    it('loads discovered plugins and registers matching contributions', async () => {
        const contribution: EditorPluginContribution = {
            commands: [{ label: 'Signal', type: 'plugin.signal' }],
            manifest: {
                capabilities: ['commands'],
                id: 'plugin.signal',
                name: 'Plugin Signal',
                pluginApiVersion: 1,
                version: '1.0.0',
            },
        };
        const registered: RegisteredEditorPlugin = {
            active: true,
            capabilities: ['commands'],
            commandTypes: ['plugin.signal'],
            manifest: contribution.manifest,
            source: '/plugins/signal/plugin.json',
        };
        const register = vi.fn(() => registered);

        const result = await loadDiscoveredEditorPlugins([
            {
                load: () => contribution,
                manifest: contribution.manifest,
                source: '/plugins/signal/plugin.json',
            },
        ], register);

        expect(result).toEqual({
            registered: [registered],
            rejected: [],
        });
        expect(register).toHaveBeenCalledWith(contribution, { source: '/plugins/signal/plugin.json' });
    });

    it('rejects loaded plugins whose contribution manifest does not match the discovered sidecar', async () => {
        const register = vi.fn();
        const result = await loadDiscoveredEditorPlugins([
            {
                load: () => ({
                    manifest: {
                        id: 'other.plugin',
                        name: 'Other Plugin',
                        version: '1.0.0',
                    },
                }),
                manifest: {
                    id: 'expected.plugin',
                    name: 'Expected Plugin',
                    version: '1.0.0',
                },
                source: '/plugins/expected/plugin.json',
            },
        ], register);

        expect(result.registered).toEqual([]);
        expect(result.rejected).toEqual([
            {
                manifestId: 'expected.plugin',
                reason: "loaded plugin id 'other.plugin' does not match discovered id 'expected.plugin'",
                source: '/plugins/expected/plugin.json',
            },
        ]);
        expect(register).not.toHaveBeenCalled();
    });
});
