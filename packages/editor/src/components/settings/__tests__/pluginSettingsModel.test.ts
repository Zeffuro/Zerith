import { describe, expect, it } from 'vitest';

import {
    createInstalledPluginLoadSummary,
    createPluginMarketplaceReadinessReport,
    createPluginSourceRecordIntegritySummary,
} from '../pluginSettingsModel';

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

    it('keeps marketplace discovery blocked until catalog and remote lifecycle policy exist', () => {
        const report = createPluginMarketplaceReadinessReport();

        expect(report.status).toBe('blocked');
        expect(report.ready).toBe(3);
        expect(report.limited).toBe(2);
        expect(report.blocked).toBe(1);
        expect(report.requirements.map((requirement) => [requirement.id, requirement.status])).toEqual([
            ['manifestTrustPolicy', 'ready'],
            ['installedPackageLoader', 'ready'],
            ['codeLoadConsent', 'ready'],
            ['remoteCatalogSource', 'blocked'],
            ['packageIntegrity', 'limited'],
            ['updateRollbackPolicy', 'limited'],
        ]);
    });

    it('returns fresh marketplace requirement objects for settings UI callers', () => {
        const report = createPluginMarketplaceReadinessReport();
        report.requirements[0].summary = 'mutated';

        expect(createPluginMarketplaceReadinessReport().requirements[0].summary)
            .toBe('Local manifests are inspected before install or load.');
    });

    it('summarizes source-record package integrity metadata for the settings UI', () => {
        expect(createPluginSourceRecordIntegritySummary({
            record: {
                install: { directoryName: 'plugin-ready', targetPath: '/plugins/plugin-ready' },
                manifest: {
                    entry: 'dist/index.js',
                    id: 'plugin.ready',
                    name: 'Plugin Ready',
                    version: '1.0.0',
                },
                manifestPath: '/source/plugin-ready/plugin.json',
                packageIntegrity: {
                    algorithm: 'sha256',
                    files: [
                        {
                            path: 'dist/index.js',
                            sha256: '039058c6f2c0cb492c533b0a4d14ef77cc0f78abccced5287d84a1a2011cfb81',
                            size: 3,
                        },
                    ],
                },
                schemaVersion: 1,
                source: '/source/plugin-ready/plugin.json',
                type: 'zerith.editorPluginSource',
            },
            source: '/plugins/plugin-ready/zerith.editorPluginSource.json',
            status: 'ready',
        })).toEqual({
            message: '1 sha256 file hash recorded.',
            status: 'ready',
        });

        expect(createPluginSourceRecordIntegritySummary({
            record: {
                install: { directoryName: 'plugin-legacy' },
                manifest: {
                    id: 'plugin.legacy',
                    name: 'Plugin Legacy',
                    version: '1.0.0',
                },
                manifestPath: '/source/plugin-legacy/plugin.json',
                schemaVersion: 1,
                source: '/source/plugin-legacy/plugin.json',
                type: 'zerith.editorPluginSource',
            },
            source: '/plugins/plugin-legacy/zerith.editorPluginSource.json',
            status: 'ready',
        })).toEqual({
            message: 'No package integrity metadata; legacy source record remains metadata-only until load.',
            status: 'limited',
        });
    });
});
