import { expect, test } from '@playwright/test';

const runtimeFailures = new WeakMap();

test.describe('browser filesystem transfers', () => {
    test.beforeEach(async ({ page }) => {
        const failures = [];
        runtimeFailures.set(page, failures);
        page.on('pageerror', error => failures.push(error.message));
        page.on('console', message => {
            if (message.type() === 'error') failures.push(message.text());
        });
        await page.route('https://fonts.googleapis.com/**', route => route.fulfill({ body: '', contentType: 'text/css' }));
    });

    test.afterEach(async ({ page }) => {
        expect(runtimeFailures.get(page), 'Browser filesystem runtime errors').toEqual([]);
    });

    test('preserves existing entries and persists transferred bytes through reload', async ({ page }) => {
        await page.goto('/');
        const result = await page.evaluate(async () => {
            const { createBrowserFsAdapter } = await import('/src/services/fs/browserFsAdapter.ts');
            const storage = await navigator.storage.getDirectory();
            const rootName = `transfer-${crypto.randomUUID()}`;
            const root = await storage.getDirectoryHandle(rootName, { create: true });
            const source = await root.getDirectoryHandle('source', { create: true });
            const nested = await source.getDirectoryHandle('nested', { create: true });
            await write(source, 'notes.txt', 'Original notes');
            await write(nested, 'audio.bin', new Uint8Array([0, 128, 255, 17]));
            await write(root, 'existing.txt', 'Keep destination');
            const adapter = createBrowserFsAdapter();
            const base = adapter.mountDirectory(root);
            await adapter.rename(`${base}/source/notes.txt`, `${base}//source/notes.txt/`);
            const samePathBytes = await adapter.readTextFile(`${base}/source/notes.txt`);
            let collision;
            try {
                await adapter.rename(`${base}/source/notes.txt`, `${base}/existing.txt`);
            } catch (error) {
                collision = error.message;
            }
            const existingBytes = await adapter.readTextFile(`${base}/existing.txt`);
            await adapter.rename(`${base}/source`, `${base}/moved`);
            let removed = false;
            try { await root.getDirectoryHandle('source'); } catch (error) { removed = error.name === 'NotFoundError'; }
            return { collision, existingBytes, removed, rootName, samePathBytes };

            async function write(directory, name, data) {
                const handle = await directory.getFileHandle(name, { create: true });
                const writable = await handle.createWritable();
                await writable.write(data);
                await writable.close();
            }
        });
        expect(result).toMatchObject({
            collision: expect.stringContaining('already exists'),
            existingBytes: 'Keep destination',
            removed: true,
            samePathBytes: 'Original notes',
        });
        await page.reload();
        const reopened = await page.evaluate(async (rootName) => {
            const { createBrowserFsAdapter } = await import('/src/services/fs/browserFsAdapter.ts');
            const storage = await navigator.storage.getDirectory();
            const root = await storage.getDirectoryHandle(rootName);
            const adapter = createBrowserFsAdapter();
            const base = adapter.mountDirectory(root);
            return {
                audio: [...await adapter.readBinaryFile(`${base}/moved/nested/audio.bin`)],
                notes: await adapter.readTextFile(`${base}/moved/notes.txt`),
            };
        }, result.rootName);
        expect(reopened).toEqual({ audio: [0, 128, 255, 17], notes: 'Original notes' });
    });

    test('rejects a descendant selected through another mounted handle', async ({ page }) => {
        await page.goto('/');
        const result = await page.evaluate(async () => {
            const { createBrowserFsAdapter } = await import('/src/services/fs/browserFsAdapter.ts');
            const storage = await navigator.storage.getDirectory();
            const root = await storage.getDirectoryHandle(`alias-${crypto.randomUUID()}`, { create: true });
            const source = await root.getDirectoryHandle('source', { create: true });
            const nested = await source.getDirectoryHandle('nested', { create: true });
            const adapter = createBrowserFsAdapter();
            const base = adapter.mountDirectory(root);
            const alias = adapter.mountDirectory(await source.getDirectoryHandle('nested'));
            let message;
            try { await adapter.rename(`${base}/source`, `${alias}/copy`); } catch (error) { message = error.message; }
            return { message, nestedNames: await names(nested), rootNames: await names(root) };

            async function names(directory) {
                const entries = [];
                for await (const [name] of directory.entries()) entries.push(name);
                return entries;
            }
        });
        expect(result).toEqual({
            message: expect.stringContaining('descendants'),
            nestedNames: [],
            rootNames: ['source'],
        });
    });

    test('aborts a failed real writable and retains the source and partial destination', async ({ page }) => {
        await page.goto('/');
        const result = await page.evaluate(async () => {
            const { createBrowserFsAdapter } = await import('/src/services/fs/browserFsAdapter.ts');
            const storage = await navigator.storage.getDirectory();
            const root = await storage.getDirectoryHandle(`failure-${crypto.randomUUID()}`, { create: true });
            const source = await root.getFileHandle('source.txt', { create: true });
            const writable = await source.createWritable();
            await writable.write('Retained source');
            await writable.close();
            let aborted = false;
            const wrappedRoot = new Proxy(root, {
                get(target, key) {
                    if (key === 'getFileHandle') return async (name, options) => {
                        const file = await target.getFileHandle(name, options);
                        if (name !== 'target.txt') return file;
                        return new Proxy(file, {
                            get(handle, property) {
                                if (property === 'createWritable') return async () => {
                                    const stream = await handle.createWritable();
                                    return {
                                        abort: async () => { await stream.abort(); aborted = true; },
                                        close: () => Promise.reject(new Error('Injected close failure')),
                                        write: stream.write.bind(stream),
                                    };
                                };
                                const value = Reflect.get(handle, property);
                                return typeof value === 'function' ? value.bind(handle) : value;
                            },
                        });
                    };
                    const value = Reflect.get(target, key);
                    return typeof value === 'function' ? value.bind(target) : value;
                },
            });
            const adapter = createBrowserFsAdapter();
            const base = adapter.mountDirectory(wrappedRoot);
            let message;
            try { await adapter.rename(`${base}/source.txt`, `${base}/target.txt`); } catch (error) { message = error.message; }
            const target = await root.getFileHandle('target.txt');
            const sourceText = await (await source.getFile()).text();
            const targetText = await (await target.getFile()).text();
            const retry = await target.createWritable();
            await retry.abort();
            return { aborted, message, sourceText, targetText };
        });
        expect(result).toMatchObject({
            aborted: true,
            message: expect.stringContaining('partial destination remains'),
            sourceText: 'Retained source',
            targetText: '',
        });
    });
});
