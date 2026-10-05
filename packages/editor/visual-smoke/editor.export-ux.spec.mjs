import { expect } from '@playwright/test';
import { unzipSync } from 'fflate';
import { readFile } from 'node:fs/promises';

import { mountFixture, openFixture, readFixture, replaceJson, setup, test } from './authoringHelpers.mjs';

test.beforeEach(async ({ page }) => { await setup(page); });

async function openExport(page) {
    await page.evaluate(async () => {
        const { useEditorStore } = await import('/src/store/useEditorStore.ts');
        useEditorStore.getState().openExportGameModal();
    });
    return page.getByRole('dialog', { name: 'Export Game' });
}

for (const fixture of ['classic-vn-starter', 'example-game']) {
    test(`exports ${fixture} to a browser folder and plays it under a subpath`, async ({ page }, testInfo) => {
        const files = await readFixture(fixture);
        replaceJson(files, 'engine.config.json', config => ({ ...config, accessibility: { ...config.accessibility, captions: true, typewriterSpeedMultiplier: 0, reducedMotion: true } }));
        const root = await mountFixture(page, files);
        await openFixture(page, root);
        const dialog = await openExport(page);
        await page.evaluate(async () => {
            globalThis.folderExportParent = await (await navigator.storage.getDirectory()).getDirectoryHandle(`exports-${crypto.randomUUID()}`, { create: true });
            globalThis.showDirectoryPicker = async () => {
                globalThis.exportPickerHadActivation = navigator.userActivation.isActive;
                return globalThis.folderExportParent;
            };
        });
        await dialog.getByLabel('Save export as', { exact: true }).selectOption('folder');
        await dialog.getByLabel('Export folder name', { exact: true }).fill('playable');
        await expect(dialog.getByLabel('Download file name')).toHaveCount(0);
        await page.screenshot({ path: testInfo.outputPath('folder-export-modal.png') });
        let downloads = 0;
        page.on('download', () => { downloads += 1; });
        await dialog.getByRole('button', { name: 'Export', exact: true }).click();
        await expect(dialog.getByRole('status')).toContainText('/playable.');
        expect(await page.evaluate(() => globalThis.exportPickerHadActivation)).toBe(true);
        expect(downloads).toBe(0);
        const exported = await page.evaluate(async () => {
            const output = {};
            async function visit(directory, prefix = '') {
                for await (const [name, handle] of directory.entries()) {
                    if (handle.kind === 'directory') await visit(handle, `${prefix}${name}/`);
                    else {
                        const bytes = new Uint8Array(await (await handle.getFile()).arrayBuffer());
                        let binary = '';
                        for (const byte of bytes) binary += String.fromCharCode(byte);
                        output[`${prefix}${name}`] = btoa(binary);
                    }
                }
            }
            await visit(await globalThis.folderExportParent.getDirectoryHandle('playable'));
            return output;
        });
        for (const [name, bytes] of Object.entries(files)) expect(exported[name], name).toBe(bytes);
        expect(exported['index.html']).toBeDefined();
        expect(exported['zerith.content.json']).toBeDefined();
        await dialog.getByRole('button', { name: 'Export', exact: true }).click();
        await expect(dialog.getByRole('status')).toContainText('exists');
        expect(await page.evaluate(async () => {
            const output = await globalThis.folderExportParent.getDirectoryHandle('playable');
            return (await (await output.getFileHandle('game.json')).getFile()).text();
        })).toBe(Buffer.from(exported['game.json'], 'base64').toString('utf8'));
        const runtime = await page.context().newPage();
        const errors = [];
        runtime.on('pageerror', error => errors.push(error.message));
        await runtime.route('**/folder-export/**', async route => {
            const name = decodeURIComponent(new URL(route.request().url()).pathname.slice('/folder-export/'.length)) || 'index.html';
            const bytes = exported[name];
            const type = name.endsWith('.js') ? 'text/javascript' : name.endsWith('.css') ? 'text/css' : name.endsWith('.svg') ? 'image/svg+xml' : name.endsWith('.html') ? 'text/html' : 'application/json';
            await route.fulfill(bytes ? { body: Buffer.from(bytes, 'base64'), contentType: type } : { status: 404 });
        });
        await runtime.goto('http://127.0.0.1:1422/folder-export/');
        await runtime.getByRole('button', { name: 'New Game', exact: true }).click();
        const firstLine = fixture === 'classic-vn-starter' ? 'Every classic visual novel starts with a room, a choice, and a promise.' : 'Rain on the glass, two case files on the desk, and one very patient renderer.';
        await expect(runtime.locator('[role="status"]').filter({ hasText: firstLine })).toHaveCount(1);
        await runtime.locator('canvas').click();
        if (fixture === 'example-game') await runtime.locator('canvas').click();
        const secondLine = fixture === 'classic-vn-starter' ? 'The promise is simple: every line should be easy to find again.' : 'I moved everything clean into this folder. No borrowed cast, no mystery licenses, no surprise assets.';
        await expect(runtime.locator('[role="status"]').filter({ hasText: secondLine })).toHaveCount(1);
        await runtime.screenshot({ path: testInfo.outputPath('folder-export-playback.png') });
        expect(errors).toEqual([]);
        await runtime.close();
    });
}

test('folder export cancellation and invalid source destinations write nothing', async ({ page }) => {
    const root = await mountFixture(page, await readFixture('classic-vn-starter'));
    await openFixture(page, root);
    const dialog = await openExport(page);
    await dialog.getByLabel('Save export as', { exact: true }).selectOption('folder');
    await page.evaluate(async () => {
        const { useProjectStore } = await import('/src/store/storeBootstrap.ts');
        globalThis.originalExportSave = useProjectStore.getState().saveAllDirtyFiles;
        globalThis.exportSaveCalls = 0;
        useProjectStore.setState({ dirtyFiles: new Set(['game.json']), saveAllDirtyFiles: async () => { globalThis.exportSaveCalls += 1; throw new Error('Unexpected save'); } });
        globalThis.showDirectoryPicker = () => Promise.reject(new DOMException('Cancelled', 'AbortError'));
    });
    await dialog.getByRole('button', { name: 'Export', exact: true }).click();
    await expect(dialog.getByRole('status')).toHaveText('Export cancelled.');
    expect(await page.evaluate(async () => {
        const { useProjectStore } = await import('/src/store/storeBootstrap.ts');
        const untouched = globalThis.exportSaveCalls === 0 && useProjectStore.getState().dirtyFiles.has('game.json');
        useProjectStore.setState({ dirtyFiles: new Set(), saveAllDirtyFiles: globalThis.originalExportSave });
        return untouched;
    })).toBe(true);
    await page.evaluate(async root => {
        const { browserFsAdapter } = await import('/src/services/fs/browserFsAdapter.ts');
        globalThis.exportSource = await browserFsAdapter.getDirectoryHandle(root);
        globalThis.showDirectoryPicker = async () => globalThis.exportSource;
    }, root);
    await dialog.getByLabel('Export folder name', { exact: true }).fill('source-output');
    await dialog.getByRole('button', { name: 'Export', exact: true }).click();
    await expect(dialog.getByRole('status')).toContainText('source project');
    expect(await page.evaluate(async () => {
        const names = [];
        for await (const [name] of globalThis.exportSource.entries()) names.push(name);
        return names.includes('source-output');
    })).toBe(false);
    await expect(dialog.getByRole('button', { name: 'Export', exact: true })).toBeEnabled();
});

for (const replacement of ['different path', 'same path']) {
    test(`rejects a project replacement at ${replacement} while the folder picker is open`, async ({ page }) => {
        const root = await mountFixture(page, await readFixture('classic-vn-starter'));
        await openFixture(page, root);
        const dialog = await openExport(page);
        await dialog.getByLabel('Save export as', { exact: true }).selectOption('folder');
        await page.evaluate(async () => {
            globalThis.folderExportParent = await (await navigator.storage.getDirectory()).getDirectoryHandle(`exports-${crypto.randomUUID()}`, { create: true });
            globalThis.showDirectoryPicker = () => new Promise(resolve => { globalThis.finishExportPicker = resolve; });
        });
        await dialog.getByRole('button', { name: 'Export', exact: true }).click();
        await expect.poll(() => page.evaluate(() => typeof globalThis.finishExportPicker)).toBe('function');
        await page.evaluate(async replacement => {
            const { useProjectStore } = await import('/src/store/storeBootstrap.ts');
            const state = useProjectStore.getState();
            globalThis.exportSaveCalls = 0;
            useProjectStore.setState({ projectGeneration: state.projectGeneration + 1,
                projectPath: replacement === 'different path' ? `${state.projectPath}-replacement` : state.projectPath,
                saveAllDirtyFiles: async () => { globalThis.exportSaveCalls += 1; throw new Error('Unexpected save'); } });
            globalThis.finishExportPicker(globalThis.folderExportParent);
        }, replacement);
        await expect(dialog.getByRole('status')).toContainText('The project changed. Start export again.');
        expect(await page.evaluate(async () => {
            const entries = [];
            for await (const [name] of globalThis.folderExportParent.entries()) entries.push(name);
            return { entries, saves: globalThis.exportSaveCalls };
        })).toEqual({ entries: [], saves: 0 });
    });
}

test('exports a copied starter as a browser download with concise options', async ({ page }) => {
    const files = await readFixture('classic-vn-starter');
    const root = await mountFixture(page, files);
    await openFixture(page, root);
    const dialog = await openExport(page);
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel('Export for')).toHaveValue('itch-html5');
    expect(await dialog.getByLabel('Export for').locator('option').evaluateAll(options => options.map(option => option.value)))
        .toEqual(['itch-html5', 'generic-web', 'local-preview']);
    await expect(dialog).toContainText('The export downloads as a ZIP archive.');
    await expect(dialog).not.toContainText(/readiness|parity|planned|smoke|supported|release gate/iu);
    await expect(dialog.getByLabel(/Output folder|ZIP file path/u)).toHaveCount(0);
    await expect(dialog.locator('button')).toHaveCount(2);
    await expect(dialog.getByLabel('Compiled content cache')).toBeHidden();
    await expect(dialog.getByLabel('Base URL')).toBeHidden();
    await dialog.getByText('Advanced', { exact: true }).click();
    await expect(dialog.getByLabel('Compiled content cache')).toHaveValue('hashed');
    await expect(dialog.getByLabel('Base URL')).toHaveValue('./');
    await expect(dialog.getByLabel('Base URL')).toBeDisabled();
    await dialog.getByLabel('Export for').selectOption('local-preview');
    await expect(dialog.getByLabel('Compiled content cache')).toHaveValue('none');
    await expect(dialog.getByLabel('Base URL')).toBeEnabled();
    await dialog.getByLabel('Export for').selectOption('generic-web');
    await expect(dialog.getByLabel('Compiled content cache')).toHaveValue('hashed');
    await dialog.getByText('Advanced', { exact: true }).click();
    await dialog.getByLabel('Download file name').fill('starter-share.zip');
    const downloaded = page.waitForEvent('download');
    await dialog.getByRole('button', { name: 'Export', exact: true }).click();
    const download = await downloaded;
    expect(download.suggestedFilename()).toBe('starter-share.zip');
    expect(await download.failure()).toBeNull();
    const zip = unzipSync(await readFile(await download.path()));
    for (const [name, base64] of Object.entries(files)) {
        if (name.split('/').some(part => ['.dev_docs', '.git', 'node_modules'].includes(part.toLowerCase()))) continue;
        expect(Buffer.from(zip[name] ?? []).toString('base64'), name).toBe(base64);
    }
    const index = Buffer.from(zip['index.html']).toString('utf8');
    const styles = Object.keys(zip).filter(name => name.startsWith('zerith-player/') && name.endsWith('.css'));
    expect(styles.length).toBeGreaterThan(0);
    for (const stylesheet of styles) {
        expect(zip[stylesheet].length).toBeGreaterThan(0);
        expect(index).toContain(stylesheet);
    }
    const compiled = JSON.parse(Buffer.from(zip['zerith.content.json']).toString('utf8'));
    expect(compiled).toHaveProperty('scenes.intro');
    await expect(dialog.getByRole('status')).toHaveText('Export complete. Your browser download is ready.');
    await expect(dialog.getByRole('button', { name: 'Export', exact: true })).toBeEnabled();
    await dialog.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(dialog).toHaveCount(0);
});

test('holds the export dialog during a pending read and recovers after an export failure', async ({ page }) => {
    const root = await mountFixture(page, await readFixture('classic-vn-starter'));
    await openFixture(page, root);
    const dialog = await openExport(page);
    await page.evaluate(async root => {
        const { browserFsAdapter } = await import('/src/services/fs/browserFsAdapter.ts');
        const original = browserFsAdapter.readBinaryFile.bind(browserFsAdapter);
        globalThis.exportReadCount = 0;
        browserFsAdapter.readBinaryFile = async (...args) => {
            if (args[0] !== `${root}/game.json`) return original(...args);
            globalThis.exportReadCount += 1;
            await new Promise(resolve => { globalThis.releaseExportRead = resolve; });
            browserFsAdapter.readBinaryFile = original;
            throw new Error('Export file read interrupted');
        };
    }, root);
    let downloads = 0;
    page.on('download', () => { downloads += 1; });
    const exportButton = dialog.getByRole('button', { name: 'Export', exact: true });
    await exportButton.scrollIntoViewIfNeeded();
    const bounds = await exportButton.boundingBox();
    await page.mouse.dblclick(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
    await expect.poll(() => page.evaluate(() => typeof globalThis.releaseExportRead)).toBe('function');
    await expect(dialog).toHaveAttribute('aria-busy', 'true');
    await expect(dialog.getByRole('button', { name: 'Exporting...' })).toBeDisabled();
    await expect(dialog.getByRole('button', { name: 'Close', exact: true })).toBeDisabled();
    await expect(dialog.getByLabel('Export for')).toBeDisabled();
    await expect(dialog.getByLabel('Download file name')).toBeDisabled();
    await page.keyboard.press('Escape');
    await page.mouse.click(2, 2);
    await expect(dialog).toBeVisible();
    expect(await page.evaluate(() => globalThis.exportReadCount)).toBe(1);
    await page.evaluate(() => globalThis.releaseExportRead());
    await expect(dialog.getByRole('status')).toContainText('Export failed: Export file read interrupted');
    await expect(dialog).toHaveAttribute('aria-busy', 'false');
    await expect(dialog.getByRole('button', { name: 'Export', exact: true })).toBeEnabled();
    expect(downloads).toBe(0);
    const download = page.waitForEvent('download');
    await dialog.getByRole('button', { name: 'Export', exact: true }).click();
    expect(await (await download).failure()).toBeNull();
    await expect(dialog.getByRole('status')).toContainText('Export complete.');
    expect(downloads).toBe(1);
});
