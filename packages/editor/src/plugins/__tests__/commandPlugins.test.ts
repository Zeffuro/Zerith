import { SchemaRegistry } from 'core/schemas';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { inferCommandFields } from '../../utils/zodInference';

function installAudioFeatureProbeStub(): void {
    vi.stubGlobal('document', {
        createElement: () => ({
            canPlayType: () => 'probably',
        }),
    });
    vi.stubGlobal('window', {});
}

function readStringField(node: unknown, key: string): string {
    if (!node || typeof node !== 'object') return '';
    const value = (node as Record<string, unknown>)[key];
    return typeof value === 'string' ? value : '';
}

describe('commandPlugins', () => {
    afterAll(() => {
        vi.unstubAllGlobals();
    });

    it('registers editor metadata and core schema for plugin commands', async () => {
        installAudioFeatureProbeStub();
        const {
            createDefaultCommand,
            getAllPlugins,
            getPlugin,
            pluginApi,
            registerCommandPlugin,
        } = await import('../commandPlugins');

        const type = 'vitest_signal_pulse';
        const schema = z.object({
            assetUrl: z.string(),
            intensity: z.number().optional(),
            type: z.literal(type),
        });

        const plugin = registerCommandPlugin({
            createDefault: () => ({ assetUrl: '/assets/fx/pulse.png', intensity: 0.5, type }),
            getSummary: (node) => readStringField(node, 'assetUrl'),
            label: 'Signal Pulse',
            quickColor: { bg: '#111827', border: '#38bdf8' },
            schema,
            type,
        });

        expect(plugin.label).toBe('Signal Pulse');
        expect(SchemaRegistry.get(type)).toBe(schema);
        expect(createDefaultCommand(type)).toEqual({
            assetUrl: '/assets/fx/pulse.png',
            intensity: 0.5,
            type,
        });
        expect(getPlugin(type).getSummary?.({ assetUrl: '/assets/fx/pulse.png', type }))
            .toBe('/assets/fx/pulse.png');
        expect(getAllPlugins().some((entry) => entry.type === type)).toBe(true);
        expect(pluginApi.getCommandTypes()).toContain(type);
        expect(SchemaRegistry.getCommandSchema().safeParse({
            assetUrl: '/assets/fx/pulse.png',
            type,
        }).success).toBe(true);
    }, 10_000);

    it('exposes registered command schemas to fallback inspector inference', async () => {
        installAudioFeatureProbeStub();
        const { registerCommandPlugin } = await import('../commandPlugins');

        const type = 'vitest_schema_fallback_command';

        registerCommandPlugin({
            schema: z.object({
                enabled: z.boolean().optional(),
                mode: z.enum(['soft', 'hard']),
                type: z.literal(type),
                volume: z.number().optional(),
            }),
            type,
        });

        expect(inferCommandFields(type)).toEqual([
            { key: 'enabled', kind: 'boolean', optional: true },
            { enumValues: ['soft', 'hard'], key: 'mode', kind: 'enum', optional: false },
            { key: 'volume', kind: 'number', optional: true },
        ]);
    });

    it('registers manifest-backed editor plugins with lifecycle hooks and capabilities', async () => {
        installAudioFeatureProbeStub();
        const {
            deactivateEditorPlugin,
            pluginApi,
            registerEditorPlugin,
        } = await import('../commandPlugins');

        const cleanup = vi.fn();
        const deactivate = vi.fn();
        const activate = vi.fn(() => cleanup);
        const type = 'vitest_manifest_signal';

        const source = '/plugins/manifest/plugin.json';
        const plugin = registerEditorPlugin({
            activate,
            commands: [{
                createDefault: () => ({ type }),
                label: 'Manifest Signal',
                type,
            }],
            deactivate,
            manifest: {
                capabilities: ['validators'],
                description: 'Test plugin manifest.',
                id: 'vitest.manifest.signal',
                name: 'Manifest Signal Pack',
                pluginApiVersion: 1,
                version: '0.1.0',
            },
        }, { source });

        expect(plugin).toEqual({
            active: true,
            capabilities: ['commands', 'validators'],
            commandTypes: [type],
            manifest: {
                capabilities: ['validators'],
                description: 'Test plugin manifest.',
                id: 'vitest.manifest.signal',
                name: 'Manifest Signal Pack',
                pluginApiVersion: 1,
                version: '0.1.0',
            },
            source,
        });
        expect(activate).toHaveBeenCalledWith(pluginApi);
        expect(pluginApi.createDefaultCommand(type)).toEqual({ type });
        expect(pluginApi.getRegisteredPlugins().find((entry) => entry.manifest.id === 'vitest.manifest.signal')?.source).toBe(source);

        expect(deactivateEditorPlugin(' vitest.manifest.signal ')).toBe(true);
        expect(cleanup).toHaveBeenCalledTimes(1);
        expect(deactivate).toHaveBeenCalledTimes(1);
        expect(pluginApi.getRegisteredPlugins().find((entry) => entry.manifest.id === 'vitest.manifest.signal')?.active).toBe(false);
        expect(pluginApi.deactivatePlugin('vitest.manifest.signal')).toBe(false);
    });

    it('rejects incompatible editor plugin API versions before activation', async () => {
        installAudioFeatureProbeStub();
        const { registerEditorPlugin } = await import('../commandPlugins');
        const activate = vi.fn();

        expect(() => registerEditorPlugin({
            activate,
            manifest: {
                id: 'vitest.incompatible.plugin',
                name: 'Incompatible Plugin',
                pluginApiVersion: 999,
                version: '0.1.0',
            },
        })).toThrow('targets plugin API v999');

        expect(activate).not.toHaveBeenCalled();
    });
});
