import { chromium, expect, test as baseTest } from '@playwright/test';
import { closeTestContext, createTestProfile, persistentContextFixture } from './testProfiles.mjs';

const failures = new WeakMap();
const test = baseTest.extend({
    context: [persistentContextFixture('browser-recent-'), { timeout: 45_000 }],
});

async function watch(page) {
    const errors = [];
    failures.set(page, errors);
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.addInitScript(() => {
        globalThis.showDirectoryPicker ??= () => Promise.reject(new DOMException('Picker not used in this check', 'AbortError'));
    });
    await page.route('https://fonts.googleapis.com/**', route => route.fulfill({ body: '', contentType: 'text/css' }));
}

async function createProjects(page) {
    return page.evaluate(async () => {
        const { browserFsAdapter: adapter } = await import('/src/services/fs/browserFsAdapter.ts');
        const { executeOpenProjectInCurrentWindow } = await import('/src/store/actions/projectOpenActions.ts');
        const base = await (await navigator.storage.getDirectory()).getDirectoryHandle(`recents-${crypto.randomUUID()}`, { create: true });
        const paths = [];
        for (const label of ['First', 'Second']) {
            const parent = await base.getDirectoryHandle(label, { create: true });
            const handle = await parent.getDirectoryHandle('Game', { create: true });
            const rootPath = await adapter.recentProjects.mountPicked(handle);
            const manifestPath = `${rootPath}/game.json`;
            await adapter.writeTextFile(manifestPath, JSON.stringify({ $schema: 'zerith/manifest', schemaVersion: 2, title: label }));
            await adapter.writeTextFile(`${rootPath}/notes.txt`, `Saved ${label}`);
            await adapter.writeBinaryFile(`${rootPath}/audio.bin`, new Uint8Array([0, 128, 255, label.length]));
            const result = await executeOpenProjectInCurrentWindow(manifestPath, { checkMigration: false, prompt: false });
            if (result.status !== 'opened-current') throw new Error('Native browser project did not open');
            paths.push(manifestPath);
        }
        return paths;
    });
}

async function state(page) {
    return page.evaluate(async () => {
        const { useProjectStore } = await import('/src/store/storeBootstrap.ts');
        const { browserFsAdapter: adapter } = await import('/src/services/fs/browserFsAdapter.ts');
        const project = useProjectStore.getState();
        return {
            dirty: [...project.dirtyFiles],
            path: project.projectPath,
            recents: adapter.recentProjects.getSnapshot(),
            title: project.manifest?.title,
        };
    });
}

async function openFromPalette(page, manifestPath) {
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await page.keyboard.press('Control+Shift+P');
    const input = page.getByRole('combobox', { name: 'Command palette search' });
    await input.fill(manifestPath);
    await page.getByRole('listbox').getByRole('option').first().click();
}

test.describe('browser recent projects', () => {
    test.beforeEach(async ({ page }) => { await watch(page); });
    test.afterEach(async ({ page }) => { expect(failures.get(page)).toEqual([]); });

    test('reopens same-named native folders from the palette after reload with durable saved bytes', async ({ page }) => {
        await page.goto('/');
        const [first, second] = await createProjects(page);
        expect(first).not.toBe(second);
        await page.reload();
        await page.evaluate(async () => {
            const { browserFsAdapter } = await import('/src/services/fs/browserFsAdapter.ts');
            await browserFsAdapter.recentProjects.ready();
        });
        expect((await state(page)).path).toBeUndefined();
        await openFromPalette(page, first);
        await expect.poll(async () => (await state(page)).title).toBe('First');
        expect(await page.evaluate(async (manifestPath) => {
            const { browserFsAdapter: adapter } = await import('/src/services/fs/browserFsAdapter.ts');
            const root = manifestPath.slice(0, -'/game.json'.length);
            return { binary: [...await adapter.readBinaryFile(`${root}/audio.bin`)], text: await adapter.readTextFile(`${root}/notes.txt`) };
        }, first)).toEqual({ binary: [0, 128, 255, 5], text: 'Saved First' });
        expect((await state(page)).dirty).toEqual([]);
        await page.evaluate(async () => {
            const { useProjectStore } = await import('/src/store/storeBootstrap.ts');
            useProjectStore.getState().setProject(undefined, []);
        });
        await expect(page.getByRole('dialog', { name: 'Recover unsaved work', exact: true })).not.toBeVisible();
        await openFromPalette(page, second);
        await expect.poll(async () => (await state(page)).title).toBe('Second');
        expect((await state(page)).recents).toHaveLength(2);
    });

    test('keeps dirty tabs on denied, cancelled, missing and invalid recent-project access', async ({ page }) => {
        await page.goto('/');
        const [first, second] = await createProjects(page);
        const result = await page.evaluate(async ({ first, second }) => {
            const { browserFsAdapter: adapter } = await import('/src/services/fs/browserFsAdapter.ts');
            const { openRecentProject } = await import('/src/hooks/useRecentProjects.ts');
            const { useProjectStore } = await import('/src/store/storeBootstrap.ts');
            const { useWorkbenchStore } = await import('/src/store/useWorkbenchStore.ts');
            const root = second.slice(0, -'/game.json'.length);
            useProjectStore.getState().markFileDirty(`${root}/notes.txt`);
            const tabId = `${root}/notes.txt`;
            useWorkbenchStore.getState().openOrFocusTab({ id: tabId, kind: 'text', path: tabId, textContent: 'Unsaved notes', title: 'notes.txt' });
            const original = FileSystemDirectoryHandle.prototype.requestPermission;
            const results = [];
            try {
                FileSystemDirectoryHandle.prototype.requestPermission = () => Promise.resolve('denied');
                results.push(await openRecentProject(first));
                FileSystemDirectoryHandle.prototype.requestPermission = () => Promise.reject(new DOMException('Cancelled', 'AbortError'));
                results.push(await openRecentProject(first));
            } finally {
                FileSystemDirectoryHandle.prototype.requestPermission = original;
            }
            const sameProject = await openRecentProject(second);
            if (sameProject.status !== 'opened-current') throw new Error('Active project did not reopen');
            const target = first.slice(0, -'/game.json'.length);
            await adapter.recentProjects.restore(first);
            await adapter.writeTextFile(first, '[');
            results.push(await openRecentProject(first));
            await adapter.remove(first);
            results.push(await openRecentProject(first));
            return {
                dirty: [...useProjectStore.getState().dirtyFiles],
                path: useProjectStore.getState().projectPath,
                results,
                tab: useWorkbenchStore.getState().tabs.find(tab => tab.id === tabId)?.textContent,
                target,
            };
        }, { first, second });
        expect(result.results).toEqual(Array.from({ length: 4 }, () => ({ status: 'cancelled' })));
        expect(result.path).toBe(second.slice(0, -'/game.json'.length));
        expect(result.dirty).toEqual([`${result.path}/notes.txt`]);
        expect(result.tab).toBe('Unsaved notes');
    });

    test('retains dirty models and saved bytes when required project references fail to load', async ({ page }) => {
        await page.goto('/');
        const [first, second] = await createProjects(page);
        const result = await page.evaluate(async ({ first, second }) => {
            const { browserFsAdapter: adapter } = await import('/src/services/fs/browserFsAdapter.ts');
            const { executeOpenProjectInCurrentWindow } = await import('/src/store/actions/projectOpenActions.ts');
            const { useProjectStore, useScriptStore } = await import('/src/store/storeBootstrap.ts');
            const { useWorkbenchStore } = await import('/src/store/useWorkbenchStore.ts');
            const root = second.slice(0, -'/game.json'.length);
            const activeFile = `${root}/notes.txt`;
            const { useSettingsStore } = await import('/src/store/useSettingsStore.ts');
            useSettingsStore.getState().setAutosaveEnabled(false);
            useProjectStore.getState().markFileDirty(activeFile);
            useWorkbenchStore.getState().openOrFocusTab({ dirty: true, id: activeFile, kind: 'text', path: activeFile, savedTextContent: 'Saved Second', textContent: 'Unsaved notes', title: 'notes.txt' });
            useScriptStore.getState().setScript([{ text: 'Unsaved model', type: 'dialogue' }]);
            const project = useProjectStore.getState();
            const tabs = useWorkbenchStore.getState().tabs;
            const script = useScriptStore.getState().rootScript;
            const recents = adapter.recentProjects.getSnapshot();
            const checks = [];
            for (const manifest of [
                { scenes: { intro: 'missing.json' } },
                { characters: 'characters.json' },
                { items: [] },
                { macros: { invalid: null } },
            ]) {
                await adapter.writeTextFile(first, JSON.stringify(manifest));
                await adapter.writeTextFile(`${first.slice(0, -'/game.json'.length)}/characters.json`, 'null');
                const opened = await executeOpenProjectInCurrentWindow(first, { checkMigration: false, prompt: false });
                checks.push({
                    opened: opened.status,
                    sameProject: useProjectStore.getState() === project,
                    sameRecents: adapter.recentProjects.getSnapshot() === recents,
                    sameScript: useScriptStore.getState().rootScript === script,
                    sameTabs: useWorkbenchStore.getState().tabs === tabs,
                });
            }
            return { checks, text: await adapter.readTextFile(activeFile) };
        }, { first, second });
        expect(result).toEqual({
            checks: Array.from({ length: 4 }, () => ({ opened: 'cancelled', sameProject: true, sameRecents: true, sameScript: true, sameTabs: true })),
            text: 'Saved Second',
        });
    });

    test('ignores an older restored handle after a newer project-open request', async ({ page }) => {
        await page.goto('/');
        const [first, second] = await createProjects(page);
        const result = await page.evaluate(async ({ first, second }) => {
            const { browserFsAdapter: adapter } = await import('/src/services/fs/browserFsAdapter.ts');
            const { openRecentProject } = await import('/src/hooks/useRecentProjects.ts');
            const { executeOpenProjectInCurrentWindow } = await import('/src/store/actions/projectOpenActions.ts');
            const { useProjectStore } = await import('/src/store/storeBootstrap.ts');
            const { useWorkbenchStore } = await import('/src/store/useWorkbenchStore.ts');
            const { useSettingsStore } = await import('/src/store/useSettingsStore.ts');
            useSettingsStore.getState().setAutosaveEnabled(false);
            const path = `${second.slice(0, -'/game.json'.length)}/notes.txt`;
            useProjectStore.getState().markFileDirty(path);
            useWorkbenchStore.getState().openOrFocusTab({ dirty: true, id: path, kind: 'text', path, savedTextContent: 'Saved Second', textContent: 'Unsaved notes', title: 'notes.txt' });
            const restore = adapter.recentProjects.restore;
            let release;
            const delayed = new Promise(resolve => { release = resolve; });
            adapter.recentProjects.restore = async manifestPath => {
                const restored = await restore(manifestPath);
                if (manifestPath === first) await delayed;
                return restored;
            };
            try {
                const older = openRecentProject(first);
                const newer = await executeOpenProjectInCurrentWindow(second, { checkMigration: false, prompt: false });
                const current = useProjectStore.getState();
                const tabs = useWorkbenchStore.getState().tabs;
                const recents = adapter.recentProjects.getSnapshot();
                release();
                const stale = await older;
                return {
                    newer: newer.status, path: useProjectStore.getState().projectPath,
                    retainedRecents: adapter.recentProjects.getSnapshot() === recents,
                    retainedSession: useProjectStore.getState() === current,
                    retainedTabs: useWorkbenchStore.getState().tabs === tabs,
                    saved: await adapter.readTextFile(path), stale: stale.status,
                };
            } finally { adapter.recentProjects.restore = restore; }
        }, { first, second });
        expect(result).toEqual({ newer: 'opened-current', path: second.slice(0, -'/game.json'.length), retainedRecents: true, retainedSession: true, retainedTabs: true, saved: 'Saved Second', stale: 'cancelled' });
    });

    test('rolls back a structured-clone failure and clears recents without deleting files or mounts', async ({ page }) => {
        await page.goto('/');
        const paths = await createProjects(page);
        const result = await page.evaluate(async (paths) => {
            const { createBrowserProjectHandleStorage } = await import('/src/services/fs/browserProjectHandleStorage.ts');
            const { browserFsAdapter: adapter } = await import('/src/services/fs/browserFsAdapter.ts');
            const storage = createBrowserProjectHandleStorage();
            const before = await storage.load();
            let failure;
            try { await storage.replace([{ ...before[0], handle: () => {} }]); } catch (error) { failure = error.message; }
            const after = await storage.load();
            await adapter.recentProjects.clear();
            return {
                after: after.map(project => project.path).sort(),
                before: before.map(project => project.path).sort(),
                failure,
                stored: await storage.load(),
                text: await adapter.readTextFile(`${paths[1].slice(0, -'/game.json'.length)}/notes.txt`),
            };
        }, paths);
        expect(result.failure).toContain('storage');
        expect(result.after).toEqual(result.before);
        expect(result.stored).toEqual([]);
        expect(result.text).toBe('Saved Second');
        await page.reload();
        await page.evaluate(async () => {
            const { browserFsAdapter } = await import('/src/services/fs/browserFsAdapter.ts');
            await browserFsAdapter.recentProjects.ready();
        });
        expect((await state(page)).recents).toEqual([]);
    });

    test('reopens a project inside a selected parent through the File menu and clears only recents', async ({ page }) => {
        await page.goto('/');
        const manifestPath = await page.evaluate(async () => {
            const { browserFsAdapter: adapter } = await import('/src/services/fs/browserFsAdapter.ts');
            const { executeOpenProjectInCurrentWindow } = await import('/src/store/actions/projectOpenActions.ts');
            const storage = await navigator.storage.getDirectory();
            const parent = await storage.getDirectoryHandle(`parent-${crypto.randomUUID()}`, { create: true });
            const root = await adapter.recentProjects.mountPicked(parent);
            await adapter.mkdir(`${root}/Created`);
            const manifestPath = `${root}/Created/game.json`;
            await adapter.writeTextFile(manifestPath, JSON.stringify({ schemaVersion: 2, title: 'Created in parent' }));
            await adapter.writeTextFile(`${root}/Created/notes.txt`, 'Saved nested project');
            const result = await executeOpenProjectInCurrentWindow(manifestPath, { checkMigration: false, prompt: false });
            if (result.status !== 'opened-current') throw new Error('Nested project did not open');
            return manifestPath;
        });
        await page.reload();
        await page.evaluate(async () => {
            const { browserFsAdapter } = await import('/src/services/fs/browserFsAdapter.ts');
            await browserFsAdapter.recentProjects.ready();
        });
        await page.getByRole('button', { exact: true, name: 'File' }).click();
        await page.getByRole('menuitem', { name: /^Open Recent \(1\)/u }).focus();
        await page.keyboard.press('Enter');
        await page.getByRole('menuitem', { name: 'Created in parent', exact: true }).focus();
        await page.keyboard.press('Enter');
        await expect.poll(async () => (await state(page)).title).toBe('Created in parent');
        const identity = await page.evaluate(async (manifestPath) => {
            const { browserFsAdapter: adapter } = await import('/src/services/fs/browserFsAdapter.ts');
            const { createBrowserProjectHandleStorage } = await import('/src/services/fs/browserProjectHandleStorage.ts');
            const { executeOpenProjectInCurrentWindow } = await import('/src/store/actions/projectOpenActions.ts');
            const storage = createBrowserProjectHandleStorage();
            const [before] = await storage.load();
            const child = await before.handle.getDirectoryHandle('Created');
            const picked = structuredClone(child);
            const pickedPath = await adapter.recentProjects.mountPicked(picked);
            await adapter.writeTextFile(manifestPath, JSON.stringify({ schemaVersion: 2, title: 'Updated nested title' }));
            const opened = await executeOpenProjectInCurrentWindow(`${pickedPath}/game.json`, { checkMigration: false, prompt: false });
            const after = await storage.load();
            return {
                count: after.length,
                name: after[0].name,
                opened: opened.status,
                path: `${pickedPath}/game.json`,
                sameChild: await picked.isSameEntry(await after[0].handle.getDirectoryHandle('Created')),
                sameParent: await before.handle.isSameEntry(after[0].handle),
            };
        }, manifestPath);
        expect(identity).toEqual({
            count: 1,
            name: 'Updated nested title',
            opened: 'opened-current',
            path: manifestPath,
            sameChild: true,
            sameParent: true,
        });
        await page.reload();
        await page.evaluate(async () => {
            const { browserFsAdapter } = await import('/src/services/fs/browserFsAdapter.ts');
            await browserFsAdapter.recentProjects.ready();
        });
        await page.getByRole('button', { exact: true, name: 'File' }).click();
        await page.getByRole('menuitem', { name: /^Open Recent \(1\)/u }).focus();
        await page.keyboard.press('Enter');
        await page.getByRole('menuitem', { name: 'Updated nested title', exact: true }).focus();
        await page.keyboard.press('Enter');
        await expect.poll(async () => (await state(page)).title).toBe('Updated nested title');
        await page.getByRole('button', { exact: true, name: 'File' }).click();
        await page.getByRole('menuitem', { name: /^Open Recent \(1\)/u }).focus();
        await page.keyboard.press('Enter');
        await page.getByRole('menuitem', { name: 'Clear Recent Projects', exact: true }).focus();
        await page.keyboard.press('Enter');
        await expect.poll(async () => (await state(page)).recents.length).toBe(0);
        expect((await state(page)).title).toBe('Updated nested title');
        expect(await page.evaluate(async (manifestPath) => {
            const { browserFsAdapter } = await import('/src/services/fs/browserFsAdapter.ts');
            return browserFsAdapter.readTextFile(`${manifestPath.slice(0, -'/game.json'.length)}/notes.txt`);
        }, manifestPath)).toBe('Saved nested project');
    });

    test('distinguishes case-sensitive project folders under the same selected parent', async ({ page }) => {
        await page.goto('/');
        const result = await page.evaluate(async () => {
            const { browserFsAdapter: adapter } = await import('/src/services/fs/browserFsAdapter.ts');
            const { executeOpenProjectInCurrentWindow } = await import('/src/store/actions/projectOpenActions.ts');
            const { useProjectStore } = await import('/src/store/storeBootstrap.ts');
            const storage = await navigator.storage.getDirectory();
            const parent = await storage.getDirectoryHandle(`case-${crypto.randomUUID()}`, { create: true });
            const root = await adapter.recentProjects.mountPicked(parent);
            const titles = [];
            for (const name of ['Game', 'game']) {
                await adapter.mkdir(`${root}/${name}`);
                const path = `${root}/${name}/game.json`;
                await adapter.writeTextFile(path, JSON.stringify({ schemaVersion: 2, title: name }));
                await executeOpenProjectInCurrentWindow(path, { checkMigration: false, prompt: false });
                titles.push(useProjectStore.getState().manifest?.title);
            }
            return { recentNames: adapter.recentProjects.getSnapshot().map(project => project.name), titles };
        });
        expect(result.titles).toEqual(['Game', 'game']);
        expect(result.recentNames).toEqual(['game', 'Game']);
    });

    test('retains stored directory handles through a full browser process restart', async ({ baseURL }, testInfo) => {
        test.setTimeout(90_000);
        const profile = await createTestProfile('browser-recent-');
        let context;
        const pages = [];
        const launch = async () => {
            context = await chromium.launchPersistentContext(profile.directory, {
                args: ['--disable-audio-output'],
                headless: true,
                viewport: testInfo.project.use.viewport,
            });
            const page = await context.newPage();
            pages.push(page);
            await watch(page);
            await page.goto(baseURL);
            return page;
        };
        try {
            let page = await launch();
            const [first] = await createProjects(page);
            await context.close();
            page = await launch();
            await page.evaluate(async () => {
                const { browserFsAdapter } = await import('/src/services/fs/browserFsAdapter.ts');
                await browserFsAdapter.recentProjects.ready();
            });
            expect((await state(page)).recents).toHaveLength(2);
            await openFromPalette(page, first);
            await expect.poll(async () => (await state(page)).title).toBe('First');
            expect(await page.evaluate(async (manifestPath) => {
                const { browserFsAdapter } = await import('/src/services/fs/browserFsAdapter.ts');
                return browserFsAdapter.readTextFile(`${manifestPath.slice(0, -'/game.json'.length)}/notes.txt`);
            }, first)).toBe('Saved First');
        } finally {
            await closeTestContext(context, profile);
            for (const page of pages) expect(failures.get(page)).toEqual([]);
        }
    });
});
