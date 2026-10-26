import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { exportGameForBrowser } from '../browserExportGame';
import { MemoryDirectoryHandle } from './browserFsAdapter.test-utilities';

const mocks = vi.hoisted(() => ({ directory: vi.fn(), prepare: vi.fn() }));
vi.mock('../webGameArtifacts', () => ({ prepareWebGameArtifacts: mocks.prepare }));
vi.mock('../fs/browserFsAdapter', () => ({ browserFsAdapter: { getDirectoryHandle: mocks.directory } }));

function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>(yes => { resolve = yes; });
    return { promise, resolve };
}
const artifacts = { artifactManifest: { version: 1 }, files: { 'index.html': new Uint8Array([1, 2, 3]) }, playerFileCount: 1, projectFiles: [] };

describe('browser export ownership', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.prepare.mockResolvedValue(artifacts);
        mocks.directory.mockResolvedValue(new MemoryDirectoryHandle('Source'));
    });
    afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

    it.each(['folder', 'zip'] as const)('does not output retired %s artifacts after a pending read', async mode => {
        const pending = deferred<typeof artifacts>();
        mocks.prepare.mockReturnValueOnce(pending.promise);
        const parent = new MemoryDirectoryHandle('Exports');
        const create = vi.spyOn(parent, 'getDirectoryHandle');
        const download = vi.spyOn(URL, 'createObjectURL');
        let current = true;
        const run = exportGameForBrowser('/A', mode === 'folder' ? { browserFolder: { folderName: 'Published', parent } } : {}, () => current);
        current = false;
        pending.resolve(artifacts);
        await expect(run).rejects.toThrow('cancelled');
        expect(create).not.toHaveBeenCalled();
        expect(download).not.toHaveBeenCalled();
        expect(mocks.directory).not.toHaveBeenCalled();
    });

    it('rechecks ownership after obtaining the source directory', async () => {
        const pending = deferred<MemoryDirectoryHandle>();
        mocks.directory.mockReturnValueOnce(pending.promise);
        const parent = new MemoryDirectoryHandle('Exports');
        let current = true;
        const run = exportGameForBrowser('/A', { browserFolder: { folderName: 'Published', parent } }, () => current);
        await vi.waitFor(() => expect(mocks.directory).toHaveBeenCalledOnce());
        current = false;
        pending.resolve(new MemoryDirectoryHandle('Source'));
        await expect(run).rejects.toThrow('cancelled');
        expect(parent.directories.size).toBe(0);
    });

    it('rejects an already retired request before preparing artifacts', async () => {
        await expect(exportGameForBrowser('/A', {}, () => false)).rejects.toThrow('cancelled');
        expect(mocks.prepare).not.toHaveBeenCalled();
    });

    it('keeps unowned prepare-only callers working', async () => {
        const result = await exportGameForBrowser('/A', { download: false });
        expect(result.stdout).toContain('Prepared browser export');
    });
});
