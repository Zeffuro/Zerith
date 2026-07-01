import { describe, expect, it, vi } from 'vitest';

import type { InstalledEditorPluginPackageDiscoveryDependencies } from '../pluginPackageLoader';
import type { EditorPluginContribution, RegisteredEditorPlugin } from '../types';

import {
    discoverInstalledEditorPluginPackages,
    EDITOR_PLUGIN_SOURCE_RECORD_FILE_NAME,
    loadInstalledEditorPluginPackages,
} from '../pluginPackageLoader';

describe('pluginPackageLoader', () => {
    it('discovers installed source-record packages and loads contributions through the registration pipeline', async () => {
        const contribution: EditorPluginContribution = {
            commands: [{ label: 'Signal', type: 'plugin.signal' }],
            manifest: {
                capabilities: ['commands'],
                entry: 'dist/index.js',
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
            source: `/plugins/plugin-signal/${EDITOR_PLUGIN_SOURCE_RECORD_FILE_NAME}`,
        };
        const dependencies = createDependencies({
            binaryFiles: {
                '/plugins/plugin-signal/dist/index.js': new Uint8Array([1, 2, 3]),
            },
            directories: {
                '/plugins': [
                    { isDirectory: true, isFile: false, isSymlink: false, name: 'plugin-signal' },
                    { isDirectory: false, isFile: true, isSymlink: false, name: 'readme.txt' },
                ],
            },
            files: {
                [`/plugins/plugin-signal/${EDITOR_PLUGIN_SOURCE_RECORD_FILE_NAME}`]: JSON.stringify(createRecord({
                    id: 'plugin.signal',
                    integritySha256: '039058c6f2c0cb492c533b0a4d14ef77cc0f78abccced5287d84a1a2011cfb81',
                    targetPath: '/plugins/plugin-signal',
                })),
            },
            modules: {
                '/plugins/plugin-signal/dist/index.js': { default: contribution },
            },
        });
        const registerPlugin = vi.fn(() => registered);

        const result = await loadInstalledEditorPluginPackages('/plugins', registerPlugin, { dependencies });

        expect(result).toEqual({
            registered: [registered],
            rejected: [],
        });
        expect(dependencies.loadModule).toHaveBeenCalledWith('/plugins/plugin-signal/dist/index.js');
        expect(dependencies.readBinaryFile).toHaveBeenCalledWith('/plugins/plugin-signal/dist/index.js');
        expect(registerPlugin).toHaveBeenCalledWith(contribution, {
            source: `/plugins/plugin-signal/${EDITOR_PLUGIN_SOURCE_RECORD_FILE_NAME}`,
        });
    });

    it('rejects invalid source records before loading plugin modules', async () => {
        const dependencies = createDependencies({
            directories: {
                '/plugins': [
                    { isDirectory: true, isFile: false, isSymlink: false, name: 'bad-record' },
                ],
            },
            files: {
                [`/plugins/bad-record/${EDITOR_PLUGIN_SOURCE_RECORD_FILE_NAME}`]: '{"type":"wrong"}',
            },
        });

        const result = await discoverInstalledEditorPluginPackages('/plugins', { dependencies });

        expect(result.candidates).toEqual([]);
        expect(result.rejected).toEqual([
            {
                reason: 'source record type must be zerith.editorPluginSource',
                source: `/plugins/bad-record/${EDITOR_PLUGIN_SOURCE_RECORD_FILE_NAME}`,
            },
        ]);
        expect(dependencies.loadModule).not.toHaveBeenCalled();
    });

    it('rejects installed records without loadable target metadata', async () => {
        const dependencies = createDependencies({
            directories: {
                '/plugins': [
                    { isDirectory: true, isFile: false, isSymlink: false, name: 'missing-entry' },
                    { isDirectory: true, isFile: false, isSymlink: false, name: 'missing-target' },
                ],
            },
            files: {
                [`/plugins/missing-entry/${EDITOR_PLUGIN_SOURCE_RECORD_FILE_NAME}`]: JSON.stringify(createRecord({
                    id: 'missing.entry',
                    omitEntry: true,
                    targetPath: '/plugins/missing-entry',
                })),
                [`/plugins/missing-target/${EDITOR_PLUGIN_SOURCE_RECORD_FILE_NAME}`]: JSON.stringify(createRecord({
                    id: 'missing.target',
                    targetPath: undefined,
                })),
            },
        });

        const result = await discoverInstalledEditorPluginPackages('/plugins', { dependencies });

        expect(result.candidates).toEqual([]);
        expect(result.rejected).toEqual([
            {
                manifestId: 'missing.entry',
                reason: 'plugin manifest entry is required before loading an installed plugin package',
                source: `/plugins/missing-entry/${EDITOR_PLUGIN_SOURCE_RECORD_FILE_NAME}`,
            },
            {
                manifestId: 'missing.target',
                reason: 'source record install.targetPath is required before loading an installed plugin package',
                source: `/plugins/missing-target/${EDITOR_PLUGIN_SOURCE_RECORD_FILE_NAME}`,
            },
        ]);
        expect(dependencies.loadModule).not.toHaveBeenCalled();
    });

    it('rejects packages with mismatched source-record integrity before loading modules', async () => {
        const dependencies = createDependencies({
            binaryFiles: {
                '/plugins/tampered.plugin/dist/index.js': new Uint8Array([1, 2, 3]),
            },
            directories: {
                '/plugins': [
                    { isDirectory: true, isFile: false, isSymlink: false, name: 'tampered.plugin' },
                ],
            },
            files: {
                [`/plugins/tampered.plugin/${EDITOR_PLUGIN_SOURCE_RECORD_FILE_NAME}`]: JSON.stringify(createRecord({
                    id: 'tampered.plugin',
                    integritySha256: '0000000000000000000000000000000000000000000000000000000000000000',
                    targetPath: '/plugins/tampered.plugin',
                })),
            },
            modules: {
                '/plugins/tampered.plugin/dist/index.js': { default: { manifest: { id: 'tampered.plugin' } } },
            },
        });

        const result = await discoverInstalledEditorPluginPackages('/plugins', { dependencies });

        expect(result.candidates).toEqual([]);
        expect(result.rejected).toEqual([
            {
                manifestId: 'tampered.plugin',
                reason: 'package integrity hash mismatch: dist/index.js',
                source: `/plugins/tampered.plugin/${EDITOR_PLUGIN_SOURCE_RECORD_FILE_NAME}`,
            },
        ]);
        expect(dependencies.loadModule).not.toHaveBeenCalled();
    });
});

function createDependencies(input: {
    binaryFiles?: Record<string, Uint8Array>;
    directories?: Record<string, Array<{ isDirectory: boolean; isFile: boolean; isSymlink: boolean; name: string; }>>;
    files?: Record<string, string>;
    modules?: Record<string, unknown>;
} = {}): InstalledEditorPluginPackageDiscoveryDependencies {
    const binaryFiles = input.binaryFiles ?? {};
    const directories = input.directories ?? { '/plugins': [] };
    const files = input.files ?? {};
    const modules = input.modules ?? {};

    return {
        join: vi.fn((...parts: string[]) => Promise.resolve(parts.join('/').replaceAll(/\/+/gu, '/'))),
        loadModule: vi.fn((entryPath: string) => Promise.resolve(modules[entryPath])),
        readBinaryFile: vi.fn((path: string) => {
            const bytes = binaryFiles[path];
            return bytes === undefined
                ? Promise.reject(new Error(`missing file: ${path}`))
                : Promise.resolve(bytes);
        }),
        readDirectory: vi.fn((path: string) => Promise.resolve(directories[path] ?? [])),
        readTextFile: vi.fn((path: string) => {
            const text = files[path];
            return text === undefined
                ? Promise.reject(new Error(`missing file: ${path}`))
                : Promise.resolve(text);
        }),
    };
}

function createRecord(input: {
    entry?: string;
    id: string;
    integritySha256?: string;
    omitEntry?: boolean;
    targetPath?: string;
}) {
    const entry = input.omitEntry ? undefined : input.entry ?? 'dist/index.js';

    return {
        install: {
            directoryName: input.id,
            ...(input.targetPath === undefined ? {} : { targetPath: input.targetPath }),
        },
        ...(entry === undefined ? {} : { entryPath: `/source/${input.id}/${entry}` }),
        manifest: {
            ...(entry === undefined ? {} : { entry }),
            id: input.id,
            name: input.id,
            pluginApiVersion: 1,
            version: '1.0.0',
        },
        manifestPath: `/source/${input.id}/plugin.json`,
        ...(input.integritySha256 === undefined
            ? {}
            : {
                packageIntegrity: {
                    algorithm: 'sha256',
                    files: [
                        {
                            path: entry ?? 'dist/index.js',
                            sha256: input.integritySha256,
                            size: 3,
                        },
                    ],
                },
            }),
        packageRoot: `/source/${input.id}`,
        schemaVersion: 1,
        source: `/source/${input.id}/plugin.json`,
        type: 'zerith.editorPluginSource',
    };
}
