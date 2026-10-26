import { describe, expect, it, vi } from 'vitest';

import type { BrowserWritableFileStream } from '../fs/browserFsAdapter';

import { AudioExportRetiredError } from '../audioExportOwnership';
import { createBrowserFsAdapter } from '../fs/browserFsAdapter';
import { createPickerGlobal, MemoryDirectoryHandle, MemoryFileHandle } from './browserFsAdapter.test-utilities';

function deferred<T>() {
    let resolve!: (value: T) => void;
    let reject!: (error: unknown) => void;
    const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
    return { promise, reject, resolve };
}

function fixture() {
    const root = new MemoryDirectoryHandle('Audio');
    const adapter = createBrowserFsAdapter(createPickerGlobal(root));
    return { adapter, path: adapter.mountDirectory(root), root };
}

describe('browser audio export ownership', () => {
    it('rechecks a retired exclusive write when its queued execution starts', async () => {
        const { adapter, path, root } = fixture();
        const entered = deferred<void>();
        const gate = deferred<void>();
        const first = new MemoryFileHandle('first.wav', '');
        const getFile = vi.spyOn(root, 'getFileHandle').mockImplementation(name => {
            root.files.set(name, first);
            return Promise.resolve(first);
        });
        const create = first.createWritable.bind(first);
        vi.spyOn(first, 'createWritable').mockImplementation(async () => {
            entered.resolve();
            await gate.promise;
            return create();
        });
        const writing = adapter.writeBinaryFileExclusive!(`${path}/first.wav`, new Uint8Array([1]));
        await entered.promise;
        let current = true;
        const stale = adapter.writeBinaryFileExclusive!(`${path}/stale.wav`, new Uint8Array([2]), () => current);
        const rejected = expect(stale).rejects.toBeInstanceOf(AudioExportRetiredError);
        current = false;
        gate.resolve();
        await writing;
        await rejected;
        expect(getFile).toHaveBeenCalledTimes(1);
        expect(root.files.has('stale.wav')).toBe(false);
        await expect(adapter.readBinaryFile(`${path}/first.wav`)).resolves.toEqual(new Uint8Array([1]));
    });

    it.each(['lookup', 'listing'] as const)('stops mutation after retirement during %s', async phase => {
        const { adapter, path, root } = fixture();
        const parent = await root.getDirectoryHandle('regions', { create: true });
        const handle = phase === 'lookup' ? root : parent;
        const original = handle.entries.bind(handle);
        const entered = deferred<void>();
        const gate = deferred<void>();
        vi.spyOn(handle, 'entries').mockImplementation(async function* () {
            entered.resolve();
            await gate.promise;
            yield* original();
        });
        const create = vi.spyOn(parent, 'getFileHandle');
        let current = true;
        const writing = adapter.writeBinaryFileExclusive!(`${path}/regions/cue.wav`, new Uint8Array([1]), () => current);
        const rejected = expect(writing).rejects.toBeInstanceOf(AudioExportRetiredError);
        await entered.promise;
        current = false;
        gate.resolve();
        await rejected;
        expect(create).not.toHaveBeenCalled();
    });

    it('checks retirement between recursive mkdir mutations', async () => {
        const { adapter, path, root } = fixture();
        const entered = deferred<void>();
        const gate = deferred<void>();
        const create = root.getDirectoryHandle.bind(root);
        vi.spyOn(root, 'getDirectoryHandle').mockImplementation(async (name, options) => {
            const handle = await create(name, options);
            entered.resolve();
            await gate.promise;
            return handle;
        });
        let current = true;
        const writing = adapter.mkdir(`${path}/assets/audio-regions`, true, () => current);
        const rejected = expect(writing).rejects.toBeInstanceOf(AudioExportRetiredError);
        await entered.promise;
        current = false;
        gate.resolve();
        await rejected;
        expect([...root.directories.keys()]).toEqual(['assets']);
        expect(root.directories.get('assets')!.directories.size).toBe(0);
    });

    it.each(['handle', 'stream', 'write', 'close'] as const)('retires during %s, preserves completed bytes and aborts pending streams', async phase => {
        const { adapter, path, root } = fixture();
        const file = new MemoryFileHandle('cue.wav', '');
        const entered = deferred<void>();
        const gate = deferred<void>();
        const createStream = file.createWritable.bind(file);
        const operations: Partial<Record<'abort' | 'close' | 'write', ReturnType<typeof vi.fn>>> = {};
        vi.spyOn(root, 'getFileHandle').mockImplementation(async name => {
            root.files.set(name, file);
            if (phase === 'handle') { entered.resolve(); await gate.promise; }
            return file;
        });
        const stream = vi.spyOn(file, 'createWritable').mockImplementation(async () => {
            const writable = await createStream();
            if (phase === 'stream') { entered.resolve(); await gate.promise; }
            const wrapped: BrowserWritableFileStream = {
                abort: operations.abort = vi.fn(() => writable.abort!()),
                close: operations.close = vi.fn(async () => {
                    await writable.close();
                    if (phase === 'close') { entered.resolve(); await gate.promise; }
                }),
                write: operations.write = vi.fn<BrowserWritableFileStream['write']>(async content => {
                    await writable.write(content);
                    if (phase === 'write') { entered.resolve(); await gate.promise; }
                }),
            };
            return wrapped;
        });
        let current = true;
        const bytes = new Uint8Array([7, 8]);
        const writing = adapter.writeBinaryFileExclusive!(`${path}/cue.wav`, bytes, () => current);
        const rejected = expect(writing).rejects.toBeInstanceOf(AudioExportRetiredError);
        await entered.promise;
        current = false;
        gate.resolve();
        await rejected;
        expect(root.files.get('cue.wav')).toBe(file);
        if (phase === 'handle') expect(stream).not.toHaveBeenCalled();
        else if (phase === 'close') {
            expect(operations.abort).not.toHaveBeenCalled();
            expect(operations.close).toHaveBeenCalledTimes(1);
        } else {
            expect(operations.abort).toHaveBeenCalledTimes(1);
            expect(operations.close).not.toHaveBeenCalled();
            if (phase === 'stream') expect(operations.write).not.toHaveBeenCalled();
        }
        await expect(adapter.readBinaryFile(`${path}/cue.wav`)).resolves.toEqual(phase === 'close' ? bytes : new Uint8Array());
    });

    it('reclassifies a stream failure after retirement and aborts without deleting the partial file', async () => {
        const { adapter, path, root } = fixture();
        const file = new MemoryFileHandle('cue.wav', '');
        const gate = deferred<void>();
        const entered = deferred<void>();
        const writable = await file.createWritable();
        vi.spyOn(root, 'getFileHandle').mockImplementation(name => {
            root.files.set(name, file);
            return Promise.resolve(file);
        });
        vi.spyOn(file, 'createWritable').mockResolvedValue({
            ...writable,
            write: () => { entered.resolve(); return gate.promise; },
        });
        let current = true;
        const writing = adapter.writeBinaryFileExclusive!(`${path}/cue.wav`, new Uint8Array([1]), () => current);
        const rejected = expect(writing).rejects.toBeInstanceOf(AudioExportRetiredError);
        await entered.promise;
        current = false;
        gate.reject(new Error('old permission failure'));
        await rejected;
        expect(file.abortCount).toBe(1);
        expect(root.files.has('cue.wav')).toBe(true);
    });

    it('allows a successor exclusive write after a retired stream abort', async () => {
        const { adapter, path, root } = fixture();
        let current = true;
        const create = root.getFileHandle.bind(root);
        vi.spyOn(root, 'getFileHandle').mockImplementation(async (name, options) => {
            const result = await create(name, options);
            if (name === 'stale.wav') current = false;
            return result;
        });
        await expect(adapter.writeBinaryFileExclusive!(`${path}/stale.wav`, new Uint8Array([1]), () => current)).rejects.toBeInstanceOf(AudioExportRetiredError);
        await adapter.writeBinaryFileExclusive!(`${path}/current.wav`, new Uint8Array([2]));
        await expect(adapter.readBinaryFile(`${path}/current.wav`)).resolves.toEqual(new Uint8Array([2]));
    });
});
