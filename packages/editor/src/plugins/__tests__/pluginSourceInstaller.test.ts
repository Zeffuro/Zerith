import { describe, expect, it, vi } from 'vitest';

import type { EditorPluginSourceRecord } from '../pluginManifestInspection';
import type { EditorPluginPackageInstallDependencies } from '../pluginSourceInstaller';

import { installEditorPluginSourceRecord } from '../pluginSourceInstaller';

describe('pluginSourceInstaller', () => {
    it('copies a validated plugin source package into a chosen install root', async () => {
        const dependencies = createDependencies({
            directories: {
                '/install/example-plugin': [],
                '/source': [
                    { isDirectory: false, isFile: true, isSymlink: false, name: 'plugin.json' },
                    { isDirectory: true, isFile: false, isSymlink: false, name: 'dist' },
                    { isDirectory: true, isFile: false, isSymlink: false, name: 'node_modules' },
                    { isDirectory: false, isFile: false, isSymlink: true, name: 'linked' },
                ],
                '/source/dist': [
                    { isDirectory: false, isFile: true, isSymlink: false, name: 'index.js' },
                ],
                '/source/node_modules': [
                    { isDirectory: false, isFile: true, isSymlink: false, name: 'ignored.js' },
                ],
            },
            files: {
                '/source/dist/index.js': new Uint8Array([1, 2, 3]),
                '/source/plugin.json': new Uint8Array([4, 5]),
            },
        });

        const result = await installEditorPluginSourceRecord(createRecord(), {
            dependencies,
            installRoot: '/install',
        });

        expect(result).toMatchObject({
            copiedFiles: [
                '/install/example-plugin/dist/index.js',
                '/install/example-plugin/plugin.json',
            ],
            skippedEntries: ['/source/linked', '/source/node_modules'],
            status: 'installed',
            targetPath: '/install/example-plugin',
        });
        expect(dependencies.writeBinaryFile).toHaveBeenCalledWith('/install/example-plugin/dist/index.js', new Uint8Array([1, 2, 3]));
        expect(dependencies.writeTextFile).toHaveBeenCalledWith(
            '/install/example-plugin/zerith.editorPluginSource.json',
            expect.stringContaining('"targetPath": "/install/example-plugin"'),
        );
    });

    it('rejects records without package roots', async () => {
        await expect(installEditorPluginSourceRecord({
            ...createRecord(),
            packageRoot: undefined,
        }, {
            dependencies: createDependencies(),
            installRoot: '/install',
        })).rejects.toThrow('missing packageRoot');
    });

    it('rejects install targets inside the source package', async () => {
        await expect(installEditorPluginSourceRecord({
            ...createRecord(),
            install: { directoryName: 'example-plugin', targetPath: '/source/installed' },
        }, {
            dependencies: createDependencies(),
        })).rejects.toThrow('cannot be inside the source package');
    });

    it('rejects non-empty targets unless overwrite is explicit', async () => {
        const dependencies = createDependencies({
            directories: {
                '/install/example-plugin': [{ isDirectory: false, isFile: true, isSymlink: false, name: 'existing.txt' }],
                '/source': [],
            },
        });

        await expect(installEditorPluginSourceRecord(createRecord(), {
            dependencies,
            installRoot: '/install',
        })).rejects.toThrow('not empty');

        await expect(installEditorPluginSourceRecord(createRecord(), {
            dependencies,
            installRoot: '/install',
            overwrite: true,
        })).resolves.toMatchObject({ status: 'installed' });
    });
});

function createDependencies(input: {
    directories?: Record<string, Array<{ isDirectory: boolean; isFile: boolean; isSymlink: boolean; name: string; }>>;
    files?: Record<string, Uint8Array>;
} = {}): EditorPluginPackageInstallDependencies {
    const directories = input.directories ?? { '/source': [] };
    const files = input.files ?? {};

    return {
        join: vi.fn((...parts: string[]) => Promise.resolve(parts.join('/').replaceAll(/\/+/gu, '/'))),
        mkdir: vi.fn(() => Promise.resolve()),
        readBinaryFile: vi.fn((path: string) => Promise.resolve(files[path] ?? new Uint8Array())),
        readDirectory: vi.fn((path: string) => {
            const entries = directories[path];
            if (!entries) return Promise.reject(new Error(`missing directory: ${path}`));
            return Promise.resolve(entries);
        }),
        writeBinaryFile: vi.fn(() => Promise.resolve()),
        writeTextFile: vi.fn(() => Promise.resolve()),
    };
}

function createRecord(): EditorPluginSourceRecord {
    return {
        entryPath: '/source/dist/index.js',
        install: {
            directoryName: 'example-plugin',
        },
        manifest: {
            entry: 'dist/index.js',
            id: 'example.plugin',
            name: 'Example Plugin',
            version: '0.1.0',
        },
        manifestPath: '/source/plugin.json',
        packageRoot: '/source',
        schemaVersion: 1,
        source: '/source/plugin.json',
        type: 'zerith.editorPluginSource' as const,
    };
}
