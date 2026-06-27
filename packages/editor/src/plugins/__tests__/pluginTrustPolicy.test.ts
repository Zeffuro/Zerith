import { describe, expect, it } from 'vitest';

import type { EditorPluginSourceRecord } from '../pluginManifestInspection';

import {
    createEditorPluginManifestTrustPolicy,
    createEditorPluginSourceRecordTrustPolicy,
    createInstalledEditorPluginLoadTrustPolicy,
} from '../pluginTrustPolicy';

describe('pluginTrustPolicy', () => {
    it('keeps raw manifest inspection metadata-only', () => {
        expect(createEditorPluginManifestTrustPolicy({
            manifest: {
                entry: 'dist/index.js',
                id: 'example.plugin',
                name: 'Example',
                version: '1.0.0',
            },
            source: '/plugins/example/plugin.json',
            status: 'ready',
        })).toEqual({
            codeLoadPolicy: 'metadata-only',
            reason: 'Raw manifest inspection validates metadata only; install a source record before loading plugin code.',
            status: 'manual-review',
        });
    });

    it('requires installed target metadata before source records can load code', () => {
        expect(createEditorPluginSourceRecordTrustPolicy({
            record: createRecord({ omitTarget: true }),
            source: '/plugins/example/zerith.editorPluginSource.json',
            status: 'ready',
        })).toEqual({
            codeLoadPolicy: 'metadata-only',
            reason: 'Source record is installable, but code loading waits until the copied package records an install target.',
            status: 'manual-review',
        });

        expect(createInstalledEditorPluginLoadTrustPolicy(createRecord({ omitTarget: true }))).toEqual({
            codeLoadPolicy: 'blocked',
            reason: 'source record install.targetPath is required before loading an installed plugin package',
            status: 'blocked',
        });
    });

    it('allows explicit installed-folder loading only when target and entry exist', () => {
        expect(createInstalledEditorPluginLoadTrustPolicy(createRecord())).toEqual({
            codeLoadPolicy: 'explicit-installed-load',
            reason: 'Installed source-record package can load only through an explicit installed-folder load action.',
            status: 'ready-to-load',
        });

        expect(createInstalledEditorPluginLoadTrustPolicy(createRecord({ omitEntry: true }))).toEqual({
            codeLoadPolicy: 'blocked',
            reason: 'plugin manifest entry is required before loading an installed plugin package',
            status: 'blocked',
        });
    });
});

function createRecord(input: { omitEntry?: boolean; omitTarget?: boolean } = {}): EditorPluginSourceRecord {
    return {
        entryPath: '/source/example/dist/index.js',
        install: {
            directoryName: 'example-plugin',
            ...(input.omitTarget === true ? {} : { targetPath: '/plugins/example-plugin' }),
        },
        manifest: {
            ...(input.omitEntry ? {} : { entry: 'dist/index.js' }),
            id: 'example.plugin',
            name: 'Example',
            version: '1.0.0',
        },
        manifestPath: '/source/example/plugin.json',
        packageRoot: '/source/example',
        schemaVersion: 1,
        source: '/source/example/plugin.json',
        type: 'zerith.editorPluginSource',
    };
}
