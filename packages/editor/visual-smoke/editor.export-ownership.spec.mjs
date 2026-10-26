import { expect } from '@playwright/test';
import { unzipSync } from 'fflate';
import { readFile } from 'node:fs/promises';

import { mountFixture, openFixture, readFixture, setup, test } from './authoringHelpers.mjs';

const changed = 'The project changed. Start export again.';
const dialogFor = page => page.getByRole('dialog', { name: 'Export Game' });

test.beforeEach(async ({ page }) => {
    page.__exportErrors = [];
    page.__exportLogs = [];
    page.__exportDownloads = [];
    page.on('pageerror', error => page.__exportErrors.push(error.message));
    page.on('console', message => {
        if (message.type() === 'error') page.__exportErrors.push(message.text());
        if (message.text().startsWith('[Export Game]')) page.__exportLogs.push(message.text());
    });
    page.on('download', download => page.__exportDownloads.push(download));
    await page.addInitScript(() => {
        globalThis.__exportRejections = [];
        globalThis.addEventListener('unhandledrejection', event => globalThis.__exportRejections.push(String(event.reason)));
    });
    await setup(page);
    await page.evaluate(async () => {
        globalThis.__exportRestores = [];
        globalThis.__exportGates = [];
        globalThis.__exportBase64 = bytes => {
            const chunks = [];
            for (let index = 0; index < bytes.length; index += 32768) chunks.push(String.fromCharCode(...bytes.subarray(index, index + 32768)));
            return btoa(chunks.join(''));
        };
        globalThis.__compiledExportHashes = 0;
        const digest = crypto.subtle.digest;
        crypto.subtle.digest = async function (algorithm, data) {
            let compiled = false;
            try {
                const bytes = ArrayBuffer.isView(data) ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength) : new Uint8Array(data);
                const value = JSON.parse(new TextDecoder().decode(bytes));
                compiled = value.$schema === 'zerith/compiled-content' && value.compilerVersion === 1;
            } catch {}
            const result = await digest.call(this, algorithm, data);
            if (compiled) globalThis.__compiledExportHashes += 1;
            return result;
        };
        globalThis.__exportRestores.push(() => { crypto.subtle.digest = digest; });
        const { useSettingsStore } = await import('/src/store/useSettingsStore.ts');
        useSettingsStore.getState().setRecoveryEnabled(false);
        useSettingsStore.getState().setAutosaveEnabled(false);
    });
});

test.afterEach(async ({ page }) => {
    await page.evaluate(async () => {
        for (const restore of globalThis.__exportRestores.toReversed()) restore();
        for (const gate of globalThis.__exportGates) gate.release();
        globalThis.__releaseFolderWrite?.();
        const { useEditorStore } = await import('/src/store/useEditorStore.ts');
        useEditorStore.getState().closeExportGameModal();
        const { closeProject } = await import('/src/store/actions/projectOpenActions.ts');
        closeProject();
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    });
    expect(page.__exportErrors).toEqual([]);
    expect(await page.evaluate(() => globalThis.__exportRejections)).toEqual([]);
    await page.goto('about:blank');
});

async function openExport(page) {
    await page.evaluate(async () => {
        const { useEditorStore } = await import('/src/store/useEditorStore.ts');
        useEditorStore.getState().openExportGameModal();
    });
    await expect(dialogFor(page)).toBeVisible();
    return dialogFor(page);
}

async function fixture(page, name) {
    const files = await readFixture(name);
    const root = await mountFixture(page, files);
    await openFixture(page, root);
    await openExport(page);
    return { files, root };
}

async function replaceSession(page, root) {
    const generations = await page.evaluate(async root => {
        const { useProjectStore } = await import('/src/store/storeBootstrap.ts');
        const before = useProjectStore.getState().projectGeneration;
        if (!await useProjectStore.getState().openProjectFromManifest(`${root}/game.json`)) throw new Error('Project replacement failed');
        return [before, useProjectStore.getState().projectGeneration];
    }, root);
    expect(generations[1]).toBeGreaterThan(generations[0]);
}

async function deferRead(page, root, fail = false) {
    return page.evaluate(async ({ root, fail }) => {
        const { browserFsAdapter: fs } = await import('/src/services/fs/browserFsAdapter.ts');
        const original = fs.readBinaryFile;
        let consumed = false;
        let release;
        const pending = new Promise(resolve => { release = resolve; });
        const id = globalThis.__exportGates.length;
        const gate = { release, started: false, settled: false, fail };
        globalThis.__exportGates.push(gate);
        globalThis.__exportRestores.push(() => { fs.readBinaryFile = original; });
        fs.readBinaryFile = async function (candidate, ...args) {
            if (consumed || candidate !== `${root}/game.json`) return original.call(this, candidate, ...args);
            consumed = true;
            const bytes = await original.call(this, candidate, ...args);
            gate.started = true;
            try {
                await pending;
                if (fail) throw new Error('Deferred export read failed');
                return bytes;
            } finally { gate.settled = true; }
        };
        return id;
    }, { root, fail });
}

async function start(page, gate) {
    await dialogFor(page).getByRole('button', { name: 'Export', exact: true }).click();
    await expect.poll(() => page.evaluate(id => globalThis.__exportGates[id].started, gate)).toBe(true);
    await expect(dialogFor(page)).toHaveAttribute('aria-busy', 'true');
}

async function release(page, gate) {
    const hash = await page.evaluate(id => {
        const gate = globalThis.__exportGates[id];
        const hash = { before: globalThis.__compiledExportHashes, expected: !gate.fail };
        gate.release();
        return hash;
    }, gate);
    await expect.poll(() => page.evaluate(id => globalThis.__exportGates[id].settled, gate)).toBe(true);
    if (hash.expected) await expect.poll(() => page.evaluate(() => globalThis.__compiledExportHashes)).toBe(hash.before + 1);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function idle(page, message = '') {
    await expect(dialogFor(page)).toHaveAttribute('aria-busy', 'false');
    await expect(dialogFor(page).getByRole('status')).toHaveText(message);
    await expect(dialogFor(page).getByRole('button', { name: 'Export', exact: true })).toBeEnabled();
    await expect(dialogFor(page).getByRole('button', { name: 'Close', exact: true })).toBeEnabled();
}

function noOldPublication(page, baseline) {
    expect(page.__exportDownloads).toHaveLength(0);
    expect(page.__exportLogs.slice(baseline)).toEqual([]);
}

async function download(page, files) {
    const pending = page.waitForEvent('download');
    await dialogFor(page).getByRole('button', { name: 'Export', exact: true }).click();
    await verifyDownload(await pending, files);
    await idle(page, 'Export complete. Your browser download is ready.');
}

async function verifyDownload(download, files) {
    expect(await download.failure()).toBeNull();
    const zip = unzipSync(await readFile(await download.path()));
    for (const [name, bytes] of Object.entries(files)) {
        if (name.split('/').some(part => ['.dev_docs', '.git', 'node_modules'].includes(part.toLowerCase()))) continue;
        expect(Buffer.from(zip[name] ?? []).toString('base64'), name).toBe(bytes);
    }
    expect(zip['index.html']?.length).toBeGreaterThan(0);
    expect(JSON.parse(Buffer.from(zip['zerith.content.json']).toString('utf8')).scenes).toHaveProperty('intro');
}

async function folderTarget(page, mode = 'normal') {
    await page.evaluate(async mode => {
        const parent = await (await navigator.storage.getDirectory()).getDirectoryHandle(`exports-${crypto.randomUUID()}`, { create: true });
        globalThis.__exportParent = parent;
        globalThis.showDirectoryPicker = async () => parent;
        const state = globalThis.__folderWrites = { created: [], closed: [], expected: {}, paused: false, released: false, closeReturned: false };
        const original = parent.getDirectoryHandle.bind(parent);
        const pending = new Promise(resolve => { globalThis.__releaseFolderWrite = () => { state.released = true; resolve(); }; });
        function decorate(directory, prefix = '') {
            const getDirectory = directory.getDirectoryHandle.bind(directory);
            const getFile = directory.getFileHandle.bind(directory);
            directory.getDirectoryHandle = async (name, options) => decorate(await getDirectory(name, options), `${prefix}${name}/`);
            directory.getFileHandle = async (name, options) => {
                const file = await getFile(name, options);
                if (!options?.create) return file;
                const path = `${prefix}${name}`;
                state.created.push(path);
                const createWritable = file.createWritable.bind(file);
                file.createWritable = async () => {
                    if (mode === 'failure') throw new Error('Folder export write denied');
                    const stream = await createWritable();
                    const write = stream.write.bind(stream);
                    const close = stream.close.bind(stream);
                    stream.write = async bytes => { state.expected[path] = globalThis.__exportBase64(bytes); await write(bytes); };
                    stream.close = async () => {
                        await close();
                        state.closed.push(path);
                        if (mode === 'pause' && state.closed.length === 1) { state.paused = true; await pending; }
                        state.closeReturned = true;
                    };
                    return stream;
                };
                return file;
            };
            return directory;
        }
        parent.getDirectoryHandle = async (name, options) => decorate(await original(name, options));
        globalThis.__exportRestores.push(() => { parent.getDirectoryHandle = original; });
    }, mode);
    await dialogFor(page).getByLabel('Save export as', { exact: true }).selectOption('folder');
    await dialogFor(page).getByLabel('Export folder name', { exact: true }).fill('owned-export');
}

async function folderFiles(page) {
    return page.evaluate(async () => {
        const output = {};
        async function visit(directory, prefix = '') {
            for await (const [name, handle] of directory.entries()) {
                if (handle.kind === 'directory') await visit(handle, `${prefix}${name}/`);
                else output[`${prefix}${name}`] = globalThis.__exportBase64(new Uint8Array(await (await handle.getFile()).arrayBuffer()));
            }
        }
        await visit(await globalThis.__exportParent.getDirectoryHandle('owned-export'));
        return output;
    });
}

for (const name of ['classic-vn-starter', 'example-game']) {
    for (const replacement of ['different path', 'same path']) {
        for (const fail of [false, true]) {
            test(`${name}: artifact read ${fail ? 'failure' : 'success'} retires after ${replacement} replacement`, async ({ page }) => {
                const { root } = await fixture(page, name);
                const next = replacement === 'same path' ? root : await mountFixture(page, await readFixture(name));
                const gate = await deferRead(page, root, fail);
                await start(page, gate);
                const baseline = page.__exportLogs.length;
                await replaceSession(page, next);
                await idle(page, changed);
                await release(page, gate);
                await idle(page, changed);
                noOldPublication(page, baseline);
            });
        }
    }

    for (const fail of [false, true]) {
        test(`${name}: close and reopen retires late artifact ${fail ? 'failure' : 'success'}`, async ({ page }) => {
            const { root } = await fixture(page, name);
            const gate = await deferRead(page, root, fail);
            await start(page, gate);
            const baseline = page.__exportLogs.length;
            await page.evaluate(async () => {
                const { useEditorStore } = await import('/src/store/useEditorStore.ts');
                useEditorStore.getState().closeExportGameModal();
            });
            await expect(dialogFor(page)).toHaveCount(0);
            await openExport(page);
            await idle(page);
            await release(page, gate);
            await idle(page);
            noOldPublication(page, baseline);
        });

        test(`${name}: successor stays busy through old artifact ${fail ? 'failure' : 'success'} and exports exact bytes`, async ({ page }) => {
            const { root, files } = await fixture(page, name);
            const old = await deferRead(page, root, fail);
            await start(page, old);
            await replaceSession(page, root);
            await idle(page, changed);
            const current = await deferRead(page, root);
            await start(page, current);
            const baseline = page.__exportLogs.length;
            await release(page, old);
            await expect(dialogFor(page)).toHaveAttribute('aria-busy', 'true');
            await expect(dialogFor(page).getByRole('status')).toHaveText('Exporting game...');
            await expect(dialogFor(page).getByRole('button', { name: 'Exporting...', exact: true })).toBeDisabled();
            await expect(dialogFor(page).getByRole('button', { name: 'Close', exact: true })).toBeDisabled();
            noOldPublication(page, baseline);
            const pending = page.waitForEvent('download');
            await release(page, current);
            await verifyDownload(await pending, files);
            await idle(page, 'Export complete. Your browser download is ready.');
            expect(page.__exportDownloads).toHaveLength(1);
            expect(page.__exportLogs.filter(text => text.includes('Build output:'))).toHaveLength(1);
        });
    }

    for (const replacement of ['different path', 'same path']) {
        test(`${name}: folder progress stops on ${replacement} replacement and retains committed bytes`, async ({ page }) => {
            const { root } = await fixture(page, name);
            const next = replacement === 'same path' ? root : await mountFixture(page, await readFixture(name));
            await folderTarget(page, 'pause');
            await dialogFor(page).getByRole('button', { name: 'Export', exact: true }).click();
            await expect.poll(() => page.evaluate(() => globalThis.__folderWrites.paused)).toBe(true);
            const prior = await folderFiles(page);
            expect(Object.keys(prior)).toHaveLength(1);
            const baseline = page.__exportLogs.length;
            await replaceSession(page, next);
            await idle(page, changed);
            await page.evaluate(() => globalThis.__releaseFolderWrite());
            await expect.poll(() => page.evaluate(() => globalThis.__folderWrites.closeReturned)).toBe(true);
            await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
            await idle(page, changed);
            expect(await folderFiles(page)).toEqual(prior);
            const writes = await page.evaluate(() => globalThis.__folderWrites);
            expect(writes.created).toHaveLength(1);
            expect(writes.closed).toHaveLength(1);
            expect(prior).toEqual(writes.expected);
            noOldPublication(page, baseline);
        });
    }

    test(`${name}: current folder export writes full fixture bytes and preserves its destination on retry`, async ({ page }) => {
        const { files } = await fixture(page, name);
        await folderTarget(page);
        await dialogFor(page).getByRole('button', { name: 'Export', exact: true }).click();
        await expect(dialogFor(page).getByRole('status')).toContainText('/owned-export.');
        const prior = await folderFiles(page);
        for (const [path, base64] of Object.entries(files)) expect(prior[path], path).toBe(base64);
        expect(Buffer.from(prior['index.html'] ?? '', 'base64').length).toBeGreaterThan(0);
        expect(Buffer.from(prior['zerith.content.json'] ?? '', 'base64').length).toBeGreaterThan(0);
        await dialogFor(page).getByRole('button', { name: 'Export', exact: true }).click();
        await expect(dialogFor(page).getByRole('status')).toContainText('already exists');
        expect(await folderFiles(page)).toEqual(prior);
        expect(page.__exportErrors.splice(0)).toEqual([expect.stringMatching(/^\[Export Game\] Export failed:.*already exists/u)]);
        expect(page.__exportDownloads).toHaveLength(0);
    });

    test(`${name}: current folder failure is visible and a new ZIP request succeeds`, async ({ page }) => {
        const { files } = await fixture(page, name);
        await folderTarget(page, 'failure');
        await dialogFor(page).getByRole('button', { name: 'Export', exact: true }).click();
        await expect(dialogFor(page).getByRole('status')).toContainText('Folder export write denied');
        await expect(dialogFor(page)).toHaveAttribute('aria-busy', 'false');
        expect(page.__exportErrors.splice(0)).toEqual([expect.stringMatching(/^\[Export Game\] Export failed:.*Folder export write denied/u)]);
        expect(page.__exportDownloads).toHaveLength(0);
        await dialogFor(page).getByLabel('Save export as', { exact: true }).selectOption('zip');
        await download(page, files);
        expect(page.__exportDownloads).toHaveLength(1);
    });
}
