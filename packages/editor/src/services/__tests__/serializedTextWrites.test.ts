import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ native: true, write: vi.fn<(...arguments_: unknown[]) => Promise<void>>() }));
vi.mock('../fs/browserFsAdapter', () => ({ browserFsAdapter: { writeTextFile: mocks.write } }));
vi.mock('../fs/tauriFsAdapter', () => ({ tauriFsAdapter: { writeTextFile: mocks.write } }));
vi.mock('../runtime/runtimeEnvironment', () => ({ isTauriRuntime: () => mocks.native }));

import { fsWriteTextFile } from '../fs/explorerFs';

function deferred() {
    let resolve!: () => void;
    let reject!: (error: Error) => void;
    const promise = new Promise<void>((done, fail) => { resolve = done; reject = fail; });
    return { promise, reject, resolve };
}

describe('serialized text writes', () => {
    beforeEach(() => { mocks.native = true; mocks.write.mockReset().mockResolvedValue(); });

    it('serializes Windows aliases and forwards compare/exclusive options', async () => {
        const first = deferred();
        mocks.write.mockReturnValueOnce(first.promise);
        const pending = fsWriteTextFile(String.raw`C:\game\locales\en.json`, 'first', { expectedContent: 'original' });
        const second = fsWriteTextFile('c:/game/locales/en.json', 'second', { expectedContent: 'first' });
        await vi.waitFor(() => { expect(mocks.write).toHaveBeenCalledTimes(1); });
        first.resolve();
        await Promise.all([pending, second]);
        expect(mocks.write.mock.calls).toEqual([
            [String.raw`C:\game\locales\en.json`, 'first', { expectedContent: 'original' }],
            ['c:/game/locales/en.json', 'second', { expectedContent: 'first' }],
        ]);
        await fsWriteTextFile('c:/game/locales/fr.json', 'new', { createOnly: true });
        expect(mocks.write).toHaveBeenLastCalledWith('c:/game/locales/fr.json', 'new', { createOnly: true });
    });

    it('does not block unrelated paths or poison retry after a failure', async () => {
        const first = deferred();
        mocks.write.mockReturnValueOnce(first.promise);
        const pending = fsWriteTextFile('/same', 'failed');
        const failed = expect(pending).rejects.toThrow('denied');
        const retry = fsWriteTextFile('/same', 'retry');
        await fsWriteTextFile('/other', 'other');
        expect(mocks.write.mock.calls.map(call => call[1])).toEqual(['failed', 'other']);
        first.reject(new Error('denied'));
        await failed;
        await retry;
        expect(mocks.write.mock.calls.map(call => call[1])).toEqual(['failed', 'other', 'retry']);
    });

    it('rejects a queued write after ownership is lost', async () => {
        const first = deferred();
        mocks.write.mockReturnValueOnce(first.promise);
        let current = true;
        const pending = fsWriteTextFile('/same', 'first');
        const queued = fsWriteTextFile('/same', 'obsolete', { createOnly: true }, () => current);
        const rejected = expect(queued).rejects.toThrow('Project changed');
        current = false;
        first.resolve();
        await Promise.all([pending, rejected]);
        expect(mocks.write).toHaveBeenCalledTimes(1);
    });

    it('serializes repeated separators and dot aliases for the same browser file', async () => {
        mocks.native = false;
        const first = deferred();
        mocks.write.mockReturnValueOnce(first.promise);
        const pending = fsWriteTextFile('/Game/locales//en.json', 'first');
        const second = fsWriteTextFile('/Game/locales/./en.json', 'second');
        const third = fsWriteTextFile('/Game/locales/other/../en.json', 'third');
        const fourth = fsWriteTextFile('//Game/locales/en.json', 'fourth');
        await vi.waitFor(() => { expect(mocks.write).toHaveBeenCalledTimes(1); });
        first.resolve();
        await Promise.all([pending, second, third, fourth]);
        expect(mocks.write.mock.calls.map(call => call[1])).toEqual(['first', 'second', 'third', 'fourth']);
    });

    it('preserves case distinctions for browser paths', async () => {
        mocks.native = false;
        const first = deferred();
        mocks.write.mockReturnValueOnce(first.promise);
        const pending = fsWriteTextFile('/project/EN.json', 'upper');
        await fsWriteTextFile('/project/en.json', 'lower');
        expect(mocks.write).toHaveBeenCalledTimes(2);
        first.resolve();
        await pending;
    });

    it('serializes native UNC aliases without merging them with local absolute paths', async () => {
        const first = deferred();
        mocks.write.mockReturnValueOnce(first.promise);
        const pending = fsWriteTextFile(String.raw`\\Server\Share\en.json`, 'unc');
        const alias = fsWriteTextFile('//server/share/./en.json', 'alias');
        await fsWriteTextFile('/server/share/en.json', 'local');
        expect(mocks.write.mock.calls.map(call => call[1])).toEqual(['unc', 'local']);
        first.resolve();
        await Promise.all([pending, alias]);
        expect(mocks.write.mock.calls.map(call => call[1])).toEqual(['unc', 'local', 'alias']);
    });
});
