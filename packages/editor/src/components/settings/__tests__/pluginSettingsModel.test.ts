import { describe, expect, it } from 'vitest';

import { createInstalledPluginLoadSummary } from '../pluginSettingsModel';

describe('pluginSettingsModel', () => {
    it('summarizes empty installed plugin loads', () => {
        expect(createInstalledPluginLoadSummary({ registered: [], rejected: [] })).toEqual({
            message: 'No installed plugin packages found.',
            registeredCount: 0,
            rejectedCount: 0,
            tone: 'muted',
        });
    });

    it('summarizes successful installed plugin loads', () => {
        expect(createInstalledPluginLoadSummary({
            registered: [
                {
                    active: true,
                    capabilities: ['commands'],
                    commandTypes: ['plugin.signal'],
                    manifest: {
                        id: 'plugin.signal',
                        name: 'Signal',
                        version: '1.0.0',
                    },
                },
            ],
            rejected: [],
        })).toEqual({
            message: 'Loaded 1 plugin package.',
            registeredCount: 1,
            rejectedCount: 0,
            tone: 'success',
        });
    });

    it('summarizes blocked and partial installed plugin loads', () => {
        expect(createInstalledPluginLoadSummary({
            registered: [],
            rejected: [{ reason: 'bad record', source: '/plugins/bad/zerith.editorPluginSource.json' }],
        })).toMatchObject({
            message: 'Blocked 1 plugin package.',
            tone: 'error',
        });

        expect(createInstalledPluginLoadSummary({
            registered: [
                {
                    active: true,
                    capabilities: [],
                    commandTypes: [],
                    manifest: {
                        id: 'plugin.ready',
                        name: 'Ready',
                        version: '1.0.0',
                    },
                },
                {
                    active: true,
                    capabilities: [],
                    commandTypes: [],
                    manifest: {
                        id: 'plugin.ready-two',
                        name: 'Ready Two',
                        version: '1.0.0',
                    },
                },
            ],
            rejected: [{ reason: 'bad record', source: '/plugins/bad/zerith.editorPluginSource.json' }],
        })).toMatchObject({
            message: 'Loaded 2 plugin packages; blocked 1.',
            registeredCount: 2,
            rejectedCount: 1,
            tone: 'warning',
        });
    });
});
