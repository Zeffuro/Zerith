import { expect } from '@playwright/test';

import { dock, mountFixture, openFixture, readFixture, replaceJson, setup, test } from './authoringHelpers.mjs';

const cancelled = 'Validation cancelled because not all dirty files could be saved.';
const status = page => page.getByRole('status').filter({ hasText: /^Validation (?:has not|is running|complete|failed:)/ });

test.beforeEach(async ({ page }) => {
    page.__validationErrors = [];
    page.on('pageerror', error => page.__validationErrors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') page.__validationErrors.push(message.text()); });
    await page.addInitScript(() => {
        globalThis.__validationRejections = [];
        globalThis.addEventListener('unhandledrejection', event => globalThis.__validationRejections.push(String(event.reason)));
    });
    await setup(page);
    await page.evaluate(async () => {
        const { useSettingsStore } = await import('/src/store/useSettingsStore.ts');
        useSettingsStore.getState().setRecoveryEnabled(false);
        useSettingsStore.getState().setAutosaveEnabled(false);
    });
});

test.afterEach(async ({ page }) => {
    expect(page.__validationErrors).toEqual([]);
    expect(await page.evaluate(() => globalThis.__validationRejections)).toEqual([]);
});

async function fixture(page, name, marker = 'current') {
    const files = await readFixture(name);
    replaceJson(files, 'game.json', manifest => ({ ...manifest, startScene: marker,
        scenes: { [marker]: [{ type: 'jump', to: `missing_${marker}` }] }, macros: {},
        localization: { ...manifest.localization, locales: {} },
    }));
    const root = await mountFixture(page, files);
    await openFixture(page, root);
    await showPanel(page);
    return { root, disk: await diskText(page, root) };
}

async function showPanel(page) {
    await dock(page, 'project_validation');
    await expect(page.getByRole('button', { name: 'Validate', exact: true })).toBeVisible();
}

async function replaceSession(page, root) {
    await page.evaluate(async root => {
        const { useProjectStore } = await import('/src/store/storeBootstrap.ts');
        if (!await useProjectStore.getState().openProjectFromManifest(`${root}/game.json`)) throw new Error('Project replacement failed');
    }, root);
}

async function run(page, entry = 'panel') {
    if (entry === 'panel') {
        await page.getByRole('button', { name: 'Validate', exact: true }).click();
        return;
    }
    await page.evaluate(async () => {
        const { useEditorStore } = await import('/src/store/useEditorStore.ts');
        useEditorStore.getState().openCommandPalette();
    });
    const palette = page.getByRole('dialog', { name: 'Command palette' });
    await palette.getByPlaceholder('Type an action (e.g. Save All, Play, Reset Layout)').fill('validate project');
    await palette.getByRole('option', { name: 'Validate Project Content' }).click();
    await expect(palette).toHaveCount(0);
}

async function logs(page) {
    return page.evaluate(async () => {
        const { useConsoleStore } = await import('/src/store/useConsoleStore.ts');
        return useConsoleStore.getState().messages.filter(message => /Project validation|Validation cancelled/.test(message.text))
            .map(message => ({ text: message.text, type: message.type }));
    });
}

async function clearLogs(page) {
    await page.evaluate(async () => {
        const { useConsoleStore } = await import('/src/store/useConsoleStore.ts');
        useConsoleStore.getState().clear();
    });
}

async function diskText(page, root) {
    return page.evaluate(async root => {
        const { browserFsAdapter: fs } = await import('/src/services/fs/browserFsAdapter.ts');
        return fs.readTextFile(`${root}/game.json`);
    }, root);
}

async function delayReport(page, root, fail = false) {
    await page.evaluate(async ({ root, fail }) => {
        const { browserFsAdapter: fs } = await import('/src/services/fs/browserFsAdapter.ts');
        const original = fs.readTextFile;
        let started;
        let release;
        const pending = new Promise(resolve => { release = resolve; });
        globalThis.__validationDelay = { release, started: new Promise(resolve => { started = resolve; }) };
        fs.readTextFile = async function (candidate, ...args) {
            if (candidate !== `${root}/game.json`) return original.call(this, candidate, ...args);
            fs.readTextFile = original;
            const text = await original.call(this, candidate, ...args);
            started();
            await pending;
            if (fail) throw new Error('Retired validation read failure');
            return text;
        };
    }, { root, fail });
}

async function release(page) {
    await page.evaluate(async () => {
        globalThis.__validationDelay.release();
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    });
}

async function started(page) {
    await page.evaluate(() => globalThis.__validationDelay.started);
}

async function assertReport(page, marker) {
    await expect(status(page)).toContainText('Validation complete.');
    await expect(page.getByPlaceholder('Filter validation rows...')).toBeVisible();
    await expect(page.getByText(`Missing scene: missing_${marker}`, { exact: true })).toBeVisible();
}

async function dirtyManifest(page, root, disk) {
    const value = { ...JSON.parse(disk), title: 'Validation preserved unsaved title' };
    const text = JSON.stringify(value, undefined, 4);
    await page.evaluate(async ({ root, disk, text }) => {
        const { useWorkbenchStore } = await import('/src/store/useWorkbenchStore.ts');
        const path = `${root}/game.json`;
        const id = `json::${path}`;
        useWorkbenchStore.getState().openOrFocusTab({ id, dirty: false, kind: 'json', path,
            savedTextContent: disk, textContent: disk, title: 'game.json', preferredView: 'json' });
        useWorkbenchStore.getState().updateTabContent(id, text);
    }, { root, disk, text });
    return text;
}

async function dirtyState(page, root) {
    return page.evaluate(async root => {
        const { useProjectStore } = await import('/src/store/storeBootstrap.ts');
        const { useWorkbenchStore } = await import('/src/store/useWorkbenchStore.ts');
        const path = `${root}/game.json`;
        const tab = useWorkbenchStore.getState().tabs.find(tab => tab.path === path);
        return { dirty: useProjectStore.getState().dirtyFiles.has(path), tabDirty: tab?.dirty, text: tab?.textContent };
    }, root);
}

async function injectSave(page, mode, root) {
    await page.evaluate(async ({ mode, root }) => {
        const { useProjectStore } = await import('/src/store/storeBootstrap.ts');
        const { browserFsAdapter: fs } = await import('/src/services/fs/browserFsAdapter.ts');
        const originalSave = useProjectStore.getState().saveAllDirtyFiles;
        const originalRead = fs.readTextFile;
        let started;
        let release;
        const pending = new Promise(resolve => { release = resolve; });
        globalThis.__validationDelay = { release, started: new Promise(resolve => { started = resolve; }), reads: 0, saves: 0 };
        fs.readTextFile = async function (candidate, ...args) {
            if (candidate === `${root}/game.json` && new Error().stack.includes('projectValidationReport.ts')) globalThis.__validationDelay.reads++;
            return originalRead.call(this, candidate, ...args);
        };
        globalThis.__restoreValidationSave = () => {
            useProjectStore.setState({ saveAllDirtyFiles: originalSave });
            fs.readTextFile = originalRead;
        };
        useProjectStore.setState({ saveAllDirtyFiles: async () => {
            globalThis.__validationDelay.saves++;
            const saved = mode === 'pending-real' || mode === 'real' ? await originalSave() : undefined;
            started();
            if (mode.startsWith('pending')) await pending;
            if (mode === 'throw') throw new Error('Injected save failure');
            return saved ?? { saved: [], failed: mode.includes('failed') ? [`${root}/game.json`] : [], skipped: [] };
        } });
    }, { mode, root });
}

async function restoreSave(page) {
    await page.evaluate(() => globalThis.__restoreValidationSave());
}

for (const name of ['classic-vn-starter', 'example-game']) {
    test(`${name}: retires an old result after successor validation and same-path reopen`, async ({ page }) => {
        const a = await fixture(page, name, 'old');
        await clearLogs(page);
        await delayReport(page, a.root);
        await run(page);
        await started(page);
        const b = await fixture(page, name, 'successor');
        await run(page);
        await assertReport(page, 'successor');
        const currentLogs = await logs(page);
        expect(currentLogs.some(message => message.text.includes('missing_successor'))).toBe(true);
        await release(page);
        await assertReport(page, 'successor');
        expect(await logs(page)).toEqual(currentLogs);
        await openFixture(page, b.root);
        await assertReport(page, 'successor');
        await replaceSession(page, b.root);
        await expect(status(page)).toHaveText('Validation has not run yet.');
        await expect(page.getByPlaceholder('Filter validation rows...')).toHaveCount(0);
        await run(page);
        await assertReport(page, 'successor');
        expect(await diskText(page, a.root)).toBe(a.disk);
        expect(await diskText(page, b.root)).toBe(b.disk);
    });

    test(`${name}: suppresses late failure through A to B to A and same-path replacement`, async ({ page }) => {
        const a = await fixture(page, name, 'old');
        const b = await fixture(page, name, 'successor');
        await openFixture(page, a.root);
        await clearLogs(page);
        await delayReport(page, a.root, true);
        await run(page);
        await started(page);
        await openFixture(page, b.root);
        await openFixture(page, a.root);
        await run(page);
        await assertReport(page, 'old');
        const currentLogs = await logs(page);
        await release(page);
        await assertReport(page, 'old');
        expect(await logs(page)).toEqual(currentLogs);
        await delayReport(page, a.root);
        await run(page);
        await started(page);
        await replaceSession(page, a.root);
        await expect(status(page)).toHaveText('Validation has not run yet.');
        await release(page);
        await expect(status(page)).toHaveText('Validation has not run yet.');
        expect(await logs(page)).toEqual(currentLogs);
    });

    test(`${name}: retires cross-entry overlap and lets palette validation outlive dismissal`, async ({ page }) => {
        const a = await fixture(page, name, 'overlap');
        await clearLogs(page);
        await delayReport(page, a.root, true);
        await run(page, 'palette');
        await started(page);
        await run(page);
        await assertReport(page, 'overlap');
        const currentLogs = await logs(page);
        await release(page);
        await assertReport(page, 'overlap');
        expect(await logs(page)).toEqual(currentLogs);
        await clearLogs(page);
        await delayReport(page, a.root);
        await run(page, 'palette');
        await started(page);
        expect(await logs(page)).toEqual([]);
        await release(page);
        await expect.poll(() => logs(page)).toEqual([{ text: expect.stringContaining('missing_overlap'), type: 'warn' }]);
        await clearLogs(page);
        await delayReport(page, a.root, true);
        await run(page);
        await started(page);
        await run(page, 'palette');
        await expect(page.getByRole('button', { name: 'Validate', exact: true })).toBeEnabled();
        await expect(status(page)).toHaveText('Validation has not run yet.');
        await expect.poll(() => logs(page)).toEqual([{ text: expect.stringContaining('missing_overlap'), type: 'warn' }]);
        const successorLogs = await logs(page);
        await release(page);
        expect(await logs(page)).toEqual(successorLogs);
        expect(await diskText(page, a.root)).toBe(a.disk);
    });

    test(`${name}: suppresses results and errors after project close and panel unmount`, async ({ page }) => {
        const a = await fixture(page, name, 'closed');
        await clearLogs(page);
        await delayReport(page, a.root, true);
        await run(page);
        await started(page);
        await page.evaluate(async () => {
            const { executeCloseProjectAction } = await import('/src/store/actions/projectOpenActions.ts');
            executeCloseProjectAction();
        });
        await expect(page.getByRole('status').filter({ hasText: 'Open a project to validate content.' })).toBeVisible();
        await release(page);
        expect(await logs(page)).toEqual([]);
        await openFixture(page, a.root);
        await delayReport(page, a.root);
        await run(page);
        await started(page);
        await page.evaluate(async () => {
            const { useEditorStore } = await import('/src/store/useEditorStore.ts');
            const editor = useEditorStore.getState();
            const json = structuredClone(editor.captureDockLayoutJson());
            function remove(node) {
                if (node.children) node.children = node.children.filter(child => child.id !== 'project_validation');
                for (const child of node.children ?? []) remove(child);
            }
            remove(json.layout);
            editor.setDockLayoutJson(json);
        });
        await expect(page.getByRole('button', { name: 'Validating...', exact: true })).toHaveCount(0);
        await release(page);
        expect(await logs(page)).toEqual([]);
    });

    for (const entry of ['panel', 'palette']) {
        test(`${name}: ${entry} cannot validate the old path after a successful pending Save All`, async ({ page }) => {
            const a = await fixture(page, name, 'saved_old');
            const text = await dirtyManifest(page, a.root, a.disk);
            await clearLogs(page);
            await injectSave(page, 'pending-real', a.root);
            await run(page, entry);
            await started(page);
            const b = await fixture(page, name, 'saved_new');
            const reads = await page.evaluate(() => globalThis.__validationDelay.reads);
            await release(page);
            expect(await page.evaluate(() => globalThis.__validationDelay.reads)).toBe(reads);
            await expect(status(page)).toHaveText('Validation has not run yet.');
            expect(await logs(page)).toEqual([]);
            await restoreSave(page);
            expect(await diskText(page, a.root)).toBe(text);
            expect(await diskText(page, b.root)).toBe(b.disk);
        });

        test(`${name}: ${entry} saves the actual dirty manifest before validating persisted content`, async ({ page }) => {
            const a = await fixture(page, name, 'saved');
            const text = await dirtyManifest(page, a.root, a.disk);
            await clearLogs(page);
            await injectSave(page, 'real', a.root);
            await run(page, entry);
            if (entry === 'panel') await assertReport(page, 'saved');
            await expect.poll(() => logs(page)).toEqual([{ text: expect.stringContaining('missing_saved'), type: 'warn' }]);
            expect(await dirtyState(page, a.root)).toEqual({ dirty: false, tabDirty: false, text });
            expect(await page.evaluate(() => ({ reads: globalThis.__validationDelay.reads, saves: globalThis.__validationDelay.saves })))
                .toEqual({ reads: 1, saves: 1 });
            await restoreSave(page);
            expect(await diskText(page, a.root)).toBe(text);
        });

        test(`${name}: ${entry} cancels failed and incomplete saves while retaining draft and disk`, async ({ page }) => {
            const a = await fixture(page, name, 'dirty');
            const text = await dirtyManifest(page, a.root, a.disk);
            for (const mode of ['failed', 'remaining', 'throw']) {
                await clearLogs(page);
                await injectSave(page, mode, a.root);
                await run(page, entry);
                await started(page);
                if (entry === 'panel') await expect(status(page)).toContainText(mode === 'throw' ? 'Injected save failure' : cancelled);
                else await expect.poll(() => logs(page)).toEqual([expect.objectContaining({ text: expect.stringContaining(mode === 'throw' ? 'Injected save failure' : cancelled) })]);
                expect(await page.evaluate(() => ({ reads: globalThis.__validationDelay.reads, saves: globalThis.__validationDelay.saves })))
                    .toEqual({ reads: 0, saves: 1 });
                expect(await dirtyState(page, a.root)).toEqual({ dirty: true, tabDirty: true, text });
                await restoreSave(page);
                expect(await diskText(page, a.root)).toBe(a.disk);
            }
        });

        test(`${name}: ${entry} retires pending saves on same-path replacement before report starts`, async ({ page }) => {
            const a = await fixture(page, name, 'save');
            const text = await dirtyManifest(page, a.root, a.disk);
            for (const mode of ['pending-failed', 'pending-success']) {
                await clearLogs(page);
                await injectSave(page, mode, a.root);
                await run(page, entry);
                await started(page);
                expect(await dirtyState(page, a.root)).toEqual({ dirty: true, tabDirty: true, text });
                await page.evaluate(async () => {
                    const { useProjectStore } = await import('/src/store/storeBootstrap.ts');
                    const state = useProjectStore.getState();
                    useProjectStore.setState({ projectGeneration: state.projectGeneration + 1 });
                });
                await expect(status(page)).toHaveText('Validation has not run yet.');
                await release(page);
                expect(await logs(page)).toEqual([]);
                expect(await page.evaluate(() => globalThis.__validationDelay.reads)).toBe(0);
                expect(await dirtyState(page, a.root)).toEqual({ dirty: true, tabDirty: true, text });
                await restoreSave(page);
                expect(await diskText(page, a.root)).toBe(a.disk);
            }
        });
    }
}
