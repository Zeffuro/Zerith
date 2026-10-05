import { expect, test as baseTest } from '@playwright/test';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { persistentContextFixture } from './testProfiles.mjs';

const test = baseTest.extend({
    context: [persistentContextFixture('recovery-profile-'), { timeout: 45_000 }],
});

async function fixture(name) {
    const root = path.resolve('games', name);
    const files = {};
    async function visit(folder, prefix = '') {
        for (const entry of await readdir(folder, { withFileTypes: true })) {
            if (entry.name === 'assets') continue;
            const relative = `${prefix}${entry.name}`;
            if (entry.isDirectory()) await visit(path.join(folder, entry.name), `${relative}/`);
            else if (entry.name.endsWith('.json')) files[relative] = await readFile(path.join(folder, entry.name), 'utf8');
        }
    }
    await visit(root);
    files['notes.txt'] = 'Original notes';
    return files;
}

async function createDrafts(page, files) {
    return page.evaluate(async files => {
        const { browserFsAdapter: fs } = await import('/src/services/fs/browserFsAdapter.ts');
        const { executeOpenProjectInCurrentWindow } = await import('/src/store/actions/projectOpenActions.ts');
        const { useProjectStore, useScriptStore } = await import('/src/store/storeBootstrap.ts');
        const { openProjectEntry } = await import('/src/services/openProjectEntry/index.ts');
        const { useWorkbenchStore } = await import('/src/store/useWorkbenchStore.ts');
        const handle = await (await navigator.storage.getDirectory()).getDirectoryHandle(`recovery-${crypto.randomUUID()}`, { create: true });
        const root = await fs.recentProjects.mountPicked(handle);
        for (const [relative, text] of Object.entries(files)) {
            const pieces = relative.split('/');
            let directory = handle;
            for (const piece of pieces.slice(0, -1)) directory = await directory.getDirectoryHandle(piece, { create: true });
            const writer = await (await directory.getFileHandle(pieces.at(-1), { create: true })).createWritable();
            await writer.write(text);
            await writer.close();
        }
        await executeOpenProjectInCurrentWindow(`${root}/game.json`, { checkMigration: false, prompt: false });
        await openProjectEntry(`${root}/scenes/intro.json`, 'intro.json');
        useScriptStore.getState().setScript([{ type: 'dialogue', text: 'Recovered visual dialogue' }]);
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        await openProjectEntry(`${root}/game.json`, 'game.json');
        const manifestTab = useWorkbenchStore.getState().tabs.find(tab => tab.path === `${root}/game.json`);
        useWorkbenchStore.getState().updateTabContent(manifestTab.id, JSON.stringify({ ...JSON.parse(files['game.json']), title: 'Recovered title' }, undefined, 4));
        await openProjectEntry(`${root}/notes.txt`, 'notes.txt');
        const notesTab = useWorkbenchStore.getState().tabs.find(tab => tab.path === `${root}/notes.txt`);
        useWorkbenchStore.getState().updateTabContent(notesTab.id, 'Recovered notes');
        if (useProjectStore.getState().dirtyFiles.size !== 3) throw new Error('Expected three recoverable edits');
        return root;
    }, files);
}

test.describe('unsaved work recovery', () => {
    const failures = new WeakMap();
    test.beforeEach(async ({ page }) => {
        const errors = [];
        failures.set(page, errors);
        page.on('pageerror', error => errors.push(error.message));
        page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
        await page.addInitScript(() => { globalThis.showDirectoryPicker ??= () => Promise.reject(new DOMException('Picker unavailable', 'AbortError')); });
        await page.route('https://fonts.googleapis.com/**', route => route.fulfill({ body: '', contentType: 'text/css' }));
        await page.goto('/');
    });
    test.afterEach(async ({ page }) => { expect(failures.get(page)).toEqual([]); });

    for (const name of ['classic-vn-starter', 'example-game']) {
        test(`reviews and restores copied ${name} edits after reload without changing disk`, async ({ page }, testInfo) => {
            const files = await fixture(name);
            const root = await createDrafts(page, files);
            await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('zerith-recovery-v1')).drafts[0].files.length)).toBe(3);
            await page.reload();
            await page.waitForSelector('[role="dialog"]');
            const dialog = page.getByRole('dialog', { name: 'Recover unsaved work' });
            await expect(dialog).toBeVisible();
            await dialog.getByRole('button', { name: 'Open project to review' }).click();
            await expect(dialog.getByRole('button', { name: 'Restore edits' })).toBeVisible();
            await expect(dialog.getByRole('textbox', { name: 'Recovery draft' }).filter({ hasText: 'Recovered notes' })).toHaveCount(1);
            await page.screenshot({ path: path.join(testInfo.outputDir, `${name}-recovery-review.png`), fullPage: true });
            await dialog.getByRole('button', { name: 'Restore edits' }).click();
            await expect(dialog).toHaveCount(0);
            const restored = await page.evaluate(async ({ root, files }) => {
                const { useProjectStore } = await import('/src/store/storeBootstrap.ts');
                const { useWorkbenchStore } = await import('/src/store/useWorkbenchStore.ts');
                const { browserFsAdapter: fs } = await import('/src/services/fs/browserFsAdapter.ts');
                const diskUnchanged = (await Promise.all(Object.entries(files).map(async ([relative, text]) => await fs.readTextFile(`${root}/${relative}`) === text))).every(Boolean);
                return { diskUnchanged, dirty: [...useProjectStore.getState().dirtyFiles], tabs: useWorkbenchStore.getState().tabs.map(tab => ({ path: tab.path, text: tab.textContent })) };
            }, { files, root });
            expect(restored.diskUnchanged).toBe(true);
            expect(restored.dirty).toHaveLength(3);
            expect(restored.tabs.find(tab => tab.path.endsWith('/notes.txt')).text).toBe('Recovered notes');
            expect(restored.tabs.find(tab => tab.path.endsWith('/intro.json')).text).toContain('Recovered visual dialogue');
            expect(JSON.parse(restored.tabs.find(tab => tab.path.endsWith('/game.json')).text).title).toBe('Recovered title');
        });
    }

    test('waits for saved folders before offering recovery', async ({ page }) => {
        await createDrafts(page, await fixture('classic-vn-starter'));
        await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('zerith-recovery-v1')).drafts[0].files.length)).toBe(3);
        await page.route('**/src/services/fs/browserProjectHandleStorage.ts', async route => {
            const response = await route.fetch();
            const body = await response.text();
            const delayed = body.replace('load: async () => {', 'load: async () => { await new Promise(resolve => setTimeout(resolve, 1500));');
            expect(delayed).not.toBe(body);
            await route.fulfill({ body: delayed, response });
        });
        await page.reload();
        const dialog = page.getByRole('dialog', { name: 'Recover unsaved work' });
        const open = dialog.getByRole('button', { name: 'Open project to review' });
        await expect(open).toBeDisabled();
        await expect(dialog.getByRole('status')).toHaveText('Loading saved project folders...');
        await open.click();
        await expect(dialog.getByRole('button', { name: 'Restore edits' })).toBeVisible();
        await expect(dialog.getByRole('alert')).toHaveCount(0);
    });

    test('shows externally changed disk bytes and keeps then discards the draft explicitly', async ({ page }) => {
        const root = await createDrafts(page, await fixture('classic-vn-starter'));
        await page.evaluate(async root => {
            const { browserFsAdapter } = await import('/src/services/fs/browserFsAdapter.ts');
            await browserFsAdapter.writeTextFile(`${root}/notes.txt`, 'External notes');
        }, root);
        await page.reload();
        await page.waitForSelector('[role="dialog"]');
        const dialog = page.getByRole('dialog', { name: 'Recover unsaved work' });
        await dialog.getByRole('button', { name: 'Open project to review' }).click();
        await expect(dialog.getByRole('textbox', { name: 'Current disk content' }).filter({ hasText: 'External notes' })).toHaveCount(1);
        await expect(dialog.getByText('notes.txt (disk changed)', { exact: true })).toBeVisible();
        await dialog.getByRole('button', { name: 'Keep for later' }).click();
        expect(await page.evaluate(() => JSON.parse(localStorage.getItem('zerith-recovery-v1')).drafts.length)).toBe(1);
        await page.reload();
        await expect(dialog).toBeVisible();
        await dialog.getByRole('button', { name: 'Discard draft' }).click();
        await expect(dialog).toHaveCount(0);
        expect(await page.evaluate(() => JSON.parse(localStorage.getItem('zerith-recovery-v1')).drafts)).toEqual([]);
    });
});
