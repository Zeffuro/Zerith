import { afterEach, describe, expect, it, vi } from 'vitest';

import type { EditorPluginPackageIntegrityFile, EditorPluginSourceRecord } from '../pluginManifestInspection';

import { verifyEditorPluginPackageIntegrity } from '../pluginPackageIntegrity';

const ENTRY_FILE: EditorPluginPackageIntegrityFile = {
    path: 'dist/index.js',
    sha256: '039058c6f2c0cb492c533b0a4d14ef77cc0f78abccced5287d84a1a2011cfb81',
    size: 3,
};

describe('pluginPackageIntegrity', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it.each([
        { files: [] },
        { files: [{ ...ENTRY_FILE, path: 'readme.txt' }] },
    ])('rejects integrity metadata that omits the declared entry (%j)', async ({ files }) => {
        const readBinaryFile = vi.fn(() => Promise.resolve(new Uint8Array([1, 2, 3])));

        expect(await verifyEditorPluginPackageIntegrity(createRecord(files), { readBinaryFile })).toEqual({
            reason: 'package integrity does not cover plugin entry: dist/index.js',
            status: 'rejected',
        });
        expect(readBinaryFile).not.toHaveBeenCalled();
    });

    it.each(['dist/index.js', './dist/index.js', 'dist/./index.js'])('verifies the declared entry recorded as %s', async (filePath) => {
        const readBinaryFile = vi.fn(() => Promise.resolve(new Uint8Array([1, 2, 3])));

        expect(await verifyEditorPluginPackageIntegrity(createRecord([{ ...ENTRY_FILE, path: filePath }]), {
            join: (...parts: string[]) => Promise.resolve(parts.join('/')),
            readBinaryFile,
        })).toEqual({ checkedFiles: 1, status: 'verified' });
        expect(readBinaryFile).toHaveBeenCalledWith(`/plugins/review.plugin/${filePath}`);
    });

    it('preserves the metadata-free legacy policy', async () => {
        const readBinaryFile = vi.fn(() => Promise.resolve(new Uint8Array([1, 2, 3])));
        const record = createRecord([]);
        record.packageIntegrity = undefined;

        expect(await verifyEditorPluginPackageIntegrity(record, { readBinaryFile })).toEqual({
            reason: 'source record has no package integrity metadata',
            status: 'skipped',
        });
        expect(readBinaryFile).not.toHaveBeenCalled();
    });

    it.each([
        { native: true, targetPath: 'F:/Plugins/review.plugin', verified: true },
        { native: true, targetPath: '//SERVER/Share/Plugins/review.plugin', verified: true },
        { native: true, targetPath: '/plugins/review.plugin', verified: false },
        { native: false, targetPath: '/plugins/review.plugin', verified: false },
        { native: false, targetPath: 'F:/Plugins/review.plugin', verified: false },
        { native: false, targetPath: '//SERVER/Share/Plugins/review.plugin', verified: false },
    ])('uses filesystem case rules for entry coverage (%j)', async ({ native, targetPath, verified }) => {
        if (native) vi.stubGlobal('__TAURI_INTERNALS__', {});
        const record = createRecord([{ ...ENTRY_FILE, path: 'dist/./Index.js' }]);
        record.install.targetPath = targetPath;
        const readBinaryFile = vi.fn(() => Promise.resolve(new Uint8Array([1, 2, 3])));
        const result = await verifyEditorPluginPackageIntegrity(record, {
            join: (...parts: string[]) => Promise.resolve(parts.join('/')),
            readBinaryFile,
        });

        expect(result).toEqual(verified
            ? { checkedFiles: 1, status: 'verified' }
            : { reason: 'package integrity does not cover plugin entry: dist/index.js', status: 'rejected' });
        expect(readBinaryFile).toHaveBeenCalledTimes(verified ? 1 : 0);
    });
});

function createRecord(files: EditorPluginPackageIntegrityFile[]): EditorPluginSourceRecord {
    return {
        install: { directoryName: 'review.plugin', targetPath: '/plugins/review.plugin' },
        manifest: { entry: 'dist/index.js', id: 'review.plugin', name: 'Review Plugin', version: '1.0.0' },
        manifestPath: '/source/plugin.json',
        packageIntegrity: { algorithm: 'sha256', files },
        schemaVersion: 1,
        source: '/source/plugin.json',
        type: 'zerith.editorPluginSource',
    };
}
