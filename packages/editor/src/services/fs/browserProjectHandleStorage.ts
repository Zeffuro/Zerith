import type { BrowserDirectoryHandle } from './browserFsAdapter';

export interface BrowserProjectHandleStorage {
    load: () => Promise<BrowserStoredProject[]>;
    replace: (projects: BrowserStoredProject[]) => Promise<void>;
}

export type BrowserStoredProject = {
    handle: BrowserDirectoryHandle;
    lastOpened: number;
    name: string;
    path: string;
};

const DATABASE_NAME = 'zerith-browser-projects';
const STORE_NAME = 'projects';
const MAX_PROJECTS = 12;

export function createBrowserProjectHandleStorage(
    indexedDatabase: IDBFactory | undefined = globalThis.indexedDB,
): BrowserProjectHandleStorage {
    return {
        load: async () => {
            const database = await openDatabase(indexedDatabase);
            try {
                return await runTransaction<BrowserStoredProject[]>(database, 'readonly', (store, setResult) => {
                    const request = store.getAll();
                    request.onsuccess = () => setResult(request.result as BrowserStoredProject[]);
                });
            } finally {
                database.close();
            }
        },
        replace: async (projects) => {
            const snapshot = projects.slice(0, MAX_PROJECTS).map((project) => ({ ...project }));
            const database = await openDatabase(indexedDatabase);
            try {
                await runTransaction<void>(database, 'readwrite', (store) => {
                    store.clear();
                    for (const project of snapshot) store.put(project);
                });
            } finally {
                database.close();
            }
        },
    };
}

function openDatabase(indexedDatabase: IDBFactory | undefined): Promise<IDBDatabase> {
    if (!indexedDatabase) return Promise.reject(new Error('Browser project storage is unavailable.'));

    return new Promise((resolve, reject) => {
        let settled = false;
        const fail = (cause: unknown) => {
            settled = true;
            reject(new Error('Could not open browser project storage.', { cause }));
        };
        let request: IDBOpenDBRequest;
        try {
            request = indexedDatabase.open(DATABASE_NAME, 1);
        } catch (error) {
            fail(error);
            return;
        }
        request.onblocked = () => fail(new Error('Another browser tab is blocking project storage.'));
        request.addEventListener('error', () => fail(request.error));
        request.onupgradeneeded = () => {
            if (settled) {
                request.transaction?.abort();
                return;
            }
            try {
                request.result.createObjectStore(STORE_NAME, { keyPath: 'path' });
            } catch (error) {
                request.transaction?.abort();
                fail(error);
            }
        };
        request.onsuccess = () => {
            const database = request.result;
            database.onversionchange = () => database.close();
            if (settled) {
                database.close();
                return;
            }
            settled = true;
            resolve(database);
        };
    });
}

function runTransaction<T>(
    database: IDBDatabase,
    mode: IDBTransactionMode,
    action: (store: IDBObjectStore, setResult: (value: T) => void) => void,
): Promise<T> {
    return new Promise((resolve, reject) => {
        let transaction: IDBTransaction;
        let result: T;
        let failure: unknown;
        const fail = (cause: unknown) => reject(new Error('Could not access browser project storage.', { cause }));
        try {
            transaction = database.transaction(STORE_NAME, mode);
        } catch (error) {
            fail(error);
            return;
        }
        transaction.oncomplete = () => resolve(result);
        transaction.addEventListener('error', () => { failure = transaction.error; });
        transaction.addEventListener('abort', () => fail(failure ?? transaction.error ?? new Error('Project storage transaction was aborted.')));
        try {
            action(transaction.objectStore(STORE_NAME), (value) => { result = value; });
        } catch (error) {
            failure = error;
            transaction.abort();
            fail(error);
        }
    });
}
