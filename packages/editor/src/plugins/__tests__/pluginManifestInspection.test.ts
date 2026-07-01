import { describe, expect, it } from 'vitest';

import {
    createEditorPluginInstallPlan,
    createEditorPluginSourceRecord,
    inspectEditorPluginManifestText,
    inspectEditorPluginSourceRecordText,
    serializeEditorPluginSourceRecord,
} from '../pluginManifestInspection';

describe('pluginManifestInspection', () => {
    it('reports install-ready compatible plugin manifests without loading code', () => {
        const result = inspectEditorPluginManifestText(JSON.stringify({
            capabilities: ['commands', 'validators'],
            description: ' Adds commands. ',
            entry: './dist/index.js',
            id: 'example.ready',
            name: ' Example Ready ',
            pluginApiVersion: 1,
            version: ' 0.1.0 ',
        }), '/plugins/example/plugin.json');

        expect(result).toEqual({
            manifest: {
                capabilities: ['commands', 'validators'],
                description: 'Adds commands.',
                entry: 'dist/index.js',
                id: 'example.ready',
                name: 'Example Ready',
                pluginApiVersion: 1,
                version: '0.1.0',
            },
            source: '/plugins/example/plugin.json',
            status: 'ready',
        });
    });

    it('derives safe install source metadata for compatible inspected manifests', () => {
        const inspection = inspectEditorPluginManifestText(JSON.stringify({
            entry: './dist/index.js',
            id: 'Example Ready',
            name: 'Example Ready',
            version: '0.1.0',
        }), '/plugins/example/plugin.json');

        expect(createEditorPluginInstallPlan(inspection, { installRoot: '/app/plugins' })).toEqual({
            entryPath: '/plugins/example/dist/index.js',
            installDirectoryName: 'example-ready',
            installTargetPath: '/app/plugins/example-ready',
            manifest: {
                entry: 'dist/index.js',
                id: 'Example Ready',
                name: 'Example Ready',
                version: '0.1.0',
            },
            manifestPath: '/plugins/example/plugin.json',
            packageRoot: '/plugins/example',
            source: '/plugins/example/plugin.json',
            status: 'ready',
        });
    });

    it('builds a deterministic plugin source record from a ready install plan', () => {
        const inspection = inspectEditorPluginManifestText(JSON.stringify({
            entry: './dist/index.js',
            id: 'Example Ready',
            name: 'Example Ready',
            version: '0.1.0',
        }), '/plugins/example/plugin.json');
        const plan = createEditorPluginInstallPlan(inspection, { installRoot: '/app/plugins' });
        const sourceRecord = createEditorPluginSourceRecord(plan);

        expect(sourceRecord).toEqual({
            record: {
                entryPath: '/plugins/example/dist/index.js',
                install: {
                    directoryName: 'example-ready',
                    targetPath: '/app/plugins/example-ready',
                },
                manifest: {
                    entry: 'dist/index.js',
                    id: 'Example Ready',
                    name: 'Example Ready',
                    version: '0.1.0',
                },
                manifestPath: '/plugins/example/plugin.json',
                packageRoot: '/plugins/example',
                schemaVersion: 1,
                source: '/plugins/example/plugin.json',
                type: 'zerith.editorPluginSource',
            },
            status: 'ready',
        });

        expect(sourceRecord.status === 'ready' ? serializeEditorPluginSourceRecord(sourceRecord.record) : '').toContain(
            '"type": "zerith.editorPluginSource"',
        );
    });

    it('loads and validates a generated plugin source record without importing plugin code', () => {
        const inspection = inspectEditorPluginManifestText(JSON.stringify({
            entry: './dist/index.js',
            id: 'Example Ready',
            name: 'Example Ready',
            version: '0.1.0',
        }), '/plugins/example/plugin.json');
        const plan = createEditorPluginInstallPlan(inspection, { installRoot: '/app/plugins' });
        const sourceRecord = createEditorPluginSourceRecord(plan);
        const text = sourceRecord.status === 'ready'
            ? serializeEditorPluginSourceRecord(sourceRecord.record)
            : '';

        expect(inspectEditorPluginSourceRecordText(text, '/records/example.source.json')).toEqual({
            record: sourceRecord.status === 'ready' ? sourceRecord.record : undefined,
            source: '/records/example.source.json',
            status: 'ready',
        });
    });

    it('rejects tampered plugin source record install metadata', () => {
        const inspection = inspectEditorPluginManifestText(JSON.stringify({
            id: 'Example Ready',
            name: 'Example Ready',
            version: '0.1.0',
        }), '/plugins/example/plugin.json');
        const plan = createEditorPluginInstallPlan(inspection);
        const sourceRecord = createEditorPluginSourceRecord(plan);
        const tampered = sourceRecord.status === 'ready'
            ? { ...sourceRecord.record, install: { directoryName: 'other-folder' } }
            : {};

        expect(inspectEditorPluginSourceRecordText(JSON.stringify(tampered), '/records/example.source.json')).toEqual({
            manifest: {
                id: 'Example Ready',
                name: 'Example Ready',
                version: '0.1.0',
            },
            reason: "install.directoryName must be 'example-ready'",
            source: '/records/example.source.json',
            status: 'rejected',
        });
    });

    it('normalizes optional source-record package integrity metadata', () => {
        const result = inspectEditorPluginSourceRecordText(JSON.stringify({
            entryPath: '/source/example/dist/index.js',
            install: { directoryName: 'example-ready', targetPath: '/plugins/example-ready' },
            manifest: {
                entry: 'dist/index.js',
                id: 'Example Ready',
                name: 'Example Ready',
                version: '0.1.0',
            },
            manifestPath: '/source/example/plugin.json',
            packageIntegrity: {
                algorithm: 'sha256',
                files: [
                    {
                        path: String.raw`\dist\index.js`,
                        sha256: '039058c6f2c0cb492c533b0a4d14ef77cc0f78abccced5287d84a1a2011cfb81',
                        size: 3,
                    },
                ],
            },
            packageRoot: '/source/example',
            schemaVersion: 1,
            source: '/source/example/plugin.json',
            type: 'zerith.editorPluginSource',
        }), '/records/example.source.json');

        expect(result.status === 'ready' ? result.record.packageIntegrity : undefined).toEqual({
            algorithm: 'sha256',
            files: [
                {
                    path: 'dist/index.js',
                    sha256: '039058c6f2c0cb492c533b0a4d14ef77cc0f78abccced5287d84a1a2011cfb81',
                    size: 3,
                },
            ],
        });
    });

    it('rejects invalid source-record package integrity metadata', () => {
        expect(inspectEditorPluginSourceRecordText(JSON.stringify({
            install: { directoryName: 'example-ready' },
            manifest: {
                id: 'Example Ready',
                name: 'Example Ready',
                version: '0.1.0',
            },
            manifestPath: '/source/example/plugin.json',
            packageIntegrity: {
                algorithm: 'sha256',
                files: [
                    {
                        path: '../dist/index.js',
                        sha256: '039058c6f2c0cb492c533b0a4d14ef77cc0f78abccced5287d84a1a2011cfb81',
                        size: 3,
                    },
                ],
            },
            schemaVersion: 1,
            source: '/source/example/plugin.json',
            type: 'zerith.editorPluginSource',
        }), '/records/example.source.json')).toMatchObject({
            reason: 'packageIntegrity.files[0].path must be a relative package path',
            status: 'rejected',
        });
    });

    it('rejects invalid JSON and incompatible plugin API versions', () => {
        expect(inspectEditorPluginManifestText('{', '/plugins/broken/plugin.json')).toMatchObject({
            source: '/plugins/broken/plugin.json',
            status: 'rejected',
        });

        expect(inspectEditorPluginManifestText(JSON.stringify({
            id: 'future.plugin',
            name: 'Future Plugin',
            pluginApiVersion: 999,
            version: '1.0.0',
        }), '/plugins/future/plugin.json')).toEqual({
            manifest: {
                id: 'future.plugin',
                name: 'Future Plugin',
                pluginApiVersion: 999,
                version: '1.0.0',
            },
            reason: 'targets plugin API v999, but this editor supports v1',
            source: '/plugins/future/plugin.json',
            status: 'rejected',
        });
    });

    it('rejects incompatible plugin API versions inside source records', () => {
        expect(inspectEditorPluginSourceRecordText(JSON.stringify({
            install: { directoryName: 'future-plugin' },
            manifest: {
                id: 'future.plugin',
                name: 'Future Plugin',
                pluginApiVersion: 999,
                version: '1.0.0',
            },
            manifestPath: '/plugins/future/plugin.json',
            schemaVersion: 1,
            source: '/plugins/future/plugin.json',
            type: 'zerith.editorPluginSource',
        }), '/records/future.source.json')).toEqual({
            manifest: {
                id: 'future.plugin',
                name: 'Future Plugin',
                pluginApiVersion: 999,
                version: '1.0.0',
            },
            reason: 'targets plugin API v999, but this editor supports v1',
            source: '/records/future.source.json',
            status: 'rejected',
        });
    });
});
