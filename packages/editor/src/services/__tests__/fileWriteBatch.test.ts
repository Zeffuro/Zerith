import { describe, expect, it, vi } from 'vitest';

import { FileWriteBatchError, writeTextFileBatch } from '../fileWriteBatch';

describe('guarded file write batches', () => {
    const files = [
        { content: 'new A', expectedContent: 'old A', filePath: '/A' },
        { content: 'new B', expectedContent: 'old B', filePath: '/B' },
        { content: 'new C', expectedContent: 'old C', filePath: '/C' },
    ];

    it('rejects a stale plan before writing any file', async () => {
        const writeTextFile = vi.fn<() => Promise<void>>().mockResolvedValue();
        const error = await writeTextFileBatch(files, { readTextFile: readStaleFile, writeTextFile }).catch((error_: unknown) => error_);
        expect(error).toBeInstanceOf(FileWriteBatchError);
        expect(error).toMatchObject({ failedPath: '/B', result: { committed: [], pending: ['/A', '/B', '/C'] } });
        expect(writeTextFile).not.toHaveBeenCalled();
    });

    it('reports exactly what committed when a later write fails', async () => {
        const writeTextFile = vi.fn<(path: string) => Promise<void>>().mockImplementation((path) => {
            if (path === '/B') throw new Error('disk full');
            return Promise.resolve();
        });
        const error = await writeTextFileBatch(files, { writeTextFile }).catch((error_: unknown) => error_);
        expect(error).toMatchObject({ failedPath: '/B', result: { committed: ['/A'], pending: ['/B', '/C'] } });
        expect(writeTextFile).toHaveBeenCalledTimes(2);
        expect(writeTextFile).toHaveBeenCalledWith('/A', 'new A', { expectedContent: 'old A' });
    });
});

function readStaleFile(path: string): Promise<string> {
    return Promise.resolve(path === '/A' ? 'old A' : 'external change');
}
