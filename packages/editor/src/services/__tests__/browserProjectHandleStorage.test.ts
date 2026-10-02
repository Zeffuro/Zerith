import { describe, expect, it, vi } from 'vitest';

import type { BrowserDirectoryHandle } from '../fs/browserFsAdapter';
import type { BrowserStoredProject } from '../fs/browserProjectHandleStorage';

import { createBrowserProjectHandleStorage } from '../fs/browserProjectHandleStorage';

function fixture() {
    const requestEvents: Record<string, () => void> = {};
    const transactionEvents: Record<string, () => void> = {};
    const request = {
        addEventListener: (event: string, listener: () => void) => { requestEvents[event] = listener; },
        error: undefined as DOMException | undefined,
        onblocked: undefined as (() => void) | undefined,
        onerror: undefined as (() => void) | undefined,
        onsuccess: undefined as (() => void) | undefined,
        onupgradeneeded: undefined as (() => void) | undefined,
        result: undefined as unknown,
        transaction: undefined as unknown,
    };
    const read = { onsuccess: undefined as (() => void) | undefined, result: [] as BrowserStoredProject[] };
    const store = { clear: vi.fn(), getAll: vi.fn(() => read), put: vi.fn<(project: BrowserStoredProject) => void>() };
    const transaction = {
        abort: vi.fn(),
        addEventListener: (event: string, listener: () => void) => { transactionEvents[event] = listener; },
        error: undefined as DOMException | undefined,
        objectStore: vi.fn(() => store),
        onabort: undefined as (() => void) | undefined,
        oncomplete: undefined as (() => void) | undefined,
        onerror: undefined as (() => void) | undefined,
    };
    const database = {
        close: vi.fn(),
        createObjectStore: vi.fn(),
        onversionchange: undefined as (() => void) | undefined,
        transaction: vi.fn(() => transaction),
    };
    request.result = database;
    request.transaction = transaction;
    const factory = { open: vi.fn(() => request) };
    const storage = createBrowserProjectHandleStorage(factory as unknown as IDBFactory);
    const open = async () => {
        request.onsuccess?.();
        await Promise.resolve();
    };
    return { database, factory, open, read, request, requestEvents, storage, store, transaction, transactionEvents };
}

function project(index = 0): BrowserStoredProject {
    return {
        handle: { kind: 'directory', name: `folder-${index}` } as BrowserDirectoryHandle,
        lastOpened: index,
        name: `folder-${index}`,
        path: `/project-${index}`,
    };
}

describe('browser project handle storage', () => {
    it('rejects when IndexedDB is unavailable', async () => {
        const storage = createBrowserProjectHandleStorage();
        await expect(storage.load()).rejects.toThrow('unavailable');
        await expect(storage.replace([])).rejects.toThrow('unavailable');
    });

    it('creates a path-keyed store in the dedicated database', async () => {
        const f = fixture();
        const pending = f.storage.replace([]);
        f.request.onupgradeneeded?.();
        expect(f.factory.open).toHaveBeenCalledWith('zerith-browser-projects', 1);
        expect(f.database.createObjectStore).toHaveBeenCalledWith('projects', { keyPath: 'path' });
        await f.open();
        f.transaction.oncomplete?.();
        await pending;
    });

    it('loads handles only after the read transaction completes and closes its connection', async () => {
        const f = fixture();
        const expected = [project()];
        const settled = vi.fn();
        const pending = f.storage.load().then((value) => { settled(); return value; });
        await f.open();
        f.read.result = expected;
        f.read.onsuccess?.();
        await Promise.resolve();
        expect(settled).not.toHaveBeenCalled();
        expect(f.database.close).not.toHaveBeenCalled();
        f.transaction.oncomplete?.();
        expect(await pending).toBe(expected);
        expect(f.database.transaction).toHaveBeenCalledWith('projects', 'readonly');
        expect(f.database.close).toHaveBeenCalledOnce();
    });

    it('replaces a bounded snapshot in one transaction without serializing the handle', async () => {
        const f = fixture();
        const projects = Array.from({ length: 15 }, (_, index) => project(index));
        const original = { ...projects[0] };
        const settled = vi.fn();
        const pending = f.storage.replace(projects).then(settled);
        projects[0].name = 'changed';
        projects.pop();
        await f.open();
        expect(f.database.transaction).toHaveBeenCalledOnce();
        expect(f.database.transaction).toHaveBeenCalledWith('projects', 'readwrite');
        expect(f.store.clear).toHaveBeenCalledOnce();
        expect(f.store.put).toHaveBeenCalledTimes(12);
        expect(f.store.put.mock.calls[0][0]).toEqual(original);
        expect(f.store.put.mock.calls[0][0].handle).toBe(original.handle);
        expect(f.store.clear.mock.invocationCallOrder[0]).toBeLessThan(f.store.put.mock.invocationCallOrder[0]);
        await Promise.resolve();
        expect(settled).not.toHaveBeenCalled();
        f.transaction.oncomplete?.();
        await pending;
        expect(f.database.close).toHaveBeenCalledOnce();
    });

    it('aborts clear and earlier writes when a later handle cannot be cloned', async () => {
        const f = fixture();
        const error = new DOMException('Cannot clone handle', 'DataCloneError');
        f.store.put.mockImplementationOnce(() => {}).mockImplementationOnce(() => { throw error; });
        const pending = f.storage.replace([project(), project(1)]);
        const rejected = expect(pending).rejects.toMatchObject({ cause: error });
        await f.open();
        await rejected;
        expect(f.transaction.abort).toHaveBeenCalledOnce();
        expect(f.database.close).toHaveBeenCalledOnce();
    });

    it('reports asynchronous transaction failures and closes the connection', async () => {
        const f = fixture();
        const pending = f.storage.replace([project()]);
        const error = new DOMException('Storage full', 'QuotaExceededError');
        const rejected = expect(pending).rejects.toMatchObject({ cause: error });
        await f.open();
        f.transaction.error = error;
        f.transactionEvents.error?.();
        f.transactionEvents.abort?.();
        await rejected;
        expect(f.database.close).toHaveBeenCalledOnce();
    });

    it('rejects transaction creation failures and closes the connection', async () => {
        const f = fixture();
        const error = new DOMException('Connection closing', 'InvalidStateError');
        f.database.transaction.mockImplementation(() => { throw error; });
        const pending = f.storage.load();
        const rejected = expect(pending).rejects.toMatchObject({ cause: error });
        await f.open();
        await rejected;
        expect(f.database.close).toHaveBeenCalledOnce();
    });

    it('rejects an aborted transaction even when no request error exists', async () => {
        const f = fixture();
        const pending = f.storage.load();
        const rejected = expect(pending).rejects.toMatchObject({
            cause: new Error('Project storage transaction was aborted.'),
        });
        await f.open();
        f.transactionEvents.abort?.();
        await rejected;
        expect(f.database.close).toHaveBeenCalledOnce();
    });

    it('wraps synchronous security failures while opening the database', async () => {
        const f = fixture();
        const error = new DOMException('Access denied', 'SecurityError');
        f.factory.open.mockImplementation(() => { throw error; });
        await expect(f.storage.load()).rejects.toMatchObject({ cause: error });
    });

    it('rejects blocked opens and closes connections that eventually open', async () => {
        const f = fixture();
        const pending = f.storage.load();
        const rejected = expect(pending).rejects.toThrow('Could not open');
        f.request.onblocked?.();
        await rejected;
        await f.open();
        expect(f.database.close).toHaveBeenCalledOnce();
        expect(f.database.transaction).not.toHaveBeenCalled();
    });

    it('reports open errors and releases a connection on version change', async () => {
        const failed = fixture();
        const error = new DOMException('Access denied', 'SecurityError');
        const pending = failed.storage.load();
        const rejected = expect(pending).rejects.toMatchObject({ cause: error });
        failed.request.error = error;
        failed.requestEvents.error?.();
        await rejected;

        const f = fixture();
        const loaded = f.storage.load();
        await f.open();
        f.database.onversionchange?.();
        expect(f.database.close).toHaveBeenCalledOnce();
        f.read.onsuccess?.();
        f.transaction.oncomplete?.();
        await loaded;
    });
});
