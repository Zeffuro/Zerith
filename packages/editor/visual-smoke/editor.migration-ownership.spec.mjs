import { expect } from '@playwright/test';

import { mountFixture, openFixture, readFixture, replaceJson, setup, test } from './authoringHelpers.mjs';

const confirmation = page => page.getByRole('dialog', { name: 'Migrate Content Schema', exact: true });

test.beforeEach(async ({ page }) => {
    page.__migrationErrors = [];
    page.on('pageerror', error => page.__migrationErrors.push(error.message));
    await page.addInitScript(() => {
        globalThis.__migrationRejections = [];
        globalThis.addEventListener('unhandledrejection', event => globalThis.__migrationRejections.push(String(event.reason)));
    });
    await setup(page);
    await page.evaluate(async () => {
        const { useSettingsStore } = await import('/src/store/useSettingsStore.ts');
        useSettingsStore.getState().setRecoveryEnabled(false);
        useSettingsStore.getState().setAutosaveEnabled(false);
    });
});

test.afterEach(async ({ page }) => {
    expect(page.__migrationErrors).toEqual([]);
    expect(await page.evaluate(() => globalThis.__migrationRejections)).toEqual([]);
});

async function fixture(page, name) {
    const files = await readFixture(name);
    replaceJson(files, 'game.json', game => ({ ...game, macros: {}, scenes: { intro: '/scenes/migration_intro.json', ending: '/scenes/migration_ending.json' }, schemaVersion: 1, startScene: 'intro' }));
    files['scenes/migration_intro.json'] = Buffer.from(JSON.stringify([{ type: 'dialogue', speaker: '', text: 'Preserved intro' }, { type: 'jump', to: 'ending' }])).toString('base64');
    files['scenes/migration_ending.json'] = Buffer.from(JSON.stringify([{ type: 'dialogue', speaker: '', text: 'Preserved ending' }])).toString('base64');
    const root = await mountFixture(page, files);
    await openFixture(page, root);
    return { root, before: await disk(page, root) };
}

async function disk(page, root) {
    return page.evaluate(async root => {
        const { browserFsAdapter: fs } = await import('/src/services/fs/browserFsAdapter.ts');
        return Object.fromEntries(await Promise.all(['game.json', 'scenes/migration_intro.json', 'scenes/migration_ending.json'].map(async path => [path, await fs.readTextFile(`${root}/${path}`)])));
    }, root);
}

async function run(page, entry = 'palette') {
    if (entry === 'menu') {
        await page.getByRole('button', { name: 'File', exact: true }).click();
        await page.getByText('Migrate Content Schema...', { exact: true }).click();
        return;
    }
    await page.evaluate(async () => {
        const { useEditorStore } = await import('/src/store/useEditorStore.ts');
        useEditorStore.getState().openCommandPalette();
    });
    const palette = page.getByRole('dialog', { name: 'Command palette' });
    await palette.getByPlaceholder('Type an action (e.g. Save All, Play, Reset Layout)').fill('migrate content');
    await palette.getByRole('option', { name: /Migrate Content Schema/ }).click();
    await expect(palette).toHaveCount(0);
}

async function dirty(page, root, before) {
    return page.evaluate(async ({ root, before }) => {
        const { useWorkbenchStore } = await import('/src/store/useWorkbenchStore.ts');
        const path = `${root}/game.json`;
        const id = `json::${path}`;
        const text = JSON.stringify({ ...JSON.parse(before), title: 'New saved author title' }, undefined, 4);
        useWorkbenchStore.getState().openOrFocusTab({ id, dirty: false, kind: 'json', path, savedTextContent: before, textContent: before, title: 'game.json', preferredView: 'json' });
        useWorkbenchStore.getState().updateTabContent(id, text);
        return text;
    }, { root, before });
}

async function logs(page) {
    return page.evaluate(async () => {
        const { useConsoleStore } = await import('/src/store/useConsoleStore.ts');
        return useConsoleStore.getState().messages.filter(message => /Content migration/.test(message.text)).map(message => message.text);
    });
}

async function replaceSession(page, root) {
    await page.evaluate(async root => {
        const { useProjectStore } = await import('/src/store/storeBootstrap.ts');
        if (!await useProjectStore.getState().openProjectFromManifest(`${root}/game.json`)) throw new Error('Replacement failed');
    }, root);
}

async function injectSave(page, mode) {
    await page.evaluate(async mode => {
        const { useProjectStore } = await import('/src/store/storeBootstrap.ts');
        const original = useProjectStore.getState().saveAllDirtyFiles;
        let release;
        let started;
        const pending = new Promise(resolve => { release = resolve; });
        globalThis.__migrationDelay = { release, started: new Promise(resolve => { started = resolve; }) };
        useProjectStore.setState({ saveAllDirtyFiles: async () => {
            started();
            if (mode === 'deferred') await pending;
            return { failed: mode === 'failed' ? ['game.json'] : [], saved: [], skipped: [] };
        } });
        globalThis.__restoreMigrationSave = () => useProjectStore.setState({ saveAllDirtyFiles: original });
    }, mode);
}

async function deferRead(page, root) {
    await page.evaluate(async root => {
        const { browserFsAdapter: fs } = await import('/src/services/fs/browserFsAdapter.ts');
        const original = fs.readTextFile;
        let release;
        let started;
        const pending = new Promise(resolve => { release = resolve; });
        globalThis.__migrationDelay = { release, started: new Promise(resolve => { started = resolve; }) };
        fs.readTextFile = async function (path, ...args) {
            if (path !== `${root}/game.json`) return original.call(this, path, ...args);
            fs.readTextFile = original;
            const value = await original.call(this, path, ...args);
            started();
            await pending;
            return value;
        };
    }, root);
}

async function release(page) {
    await page.evaluate(async () => {
        globalThis.__migrationDelay.release();
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    });
}

for (const name of ['classic-vn-starter', 'example-game']) {
    for (const entry of ['menu', 'palette']) {
        for (const mode of ['failed', 'remaining']) {
            test(`${name}: ${entry} migration blocks ${mode} Save All and preserves drafts`, async ({ page }) => {
                const { root, before } = await fixture(page, name);
                const text = await dirty(page, root, before['game.json']);
                await injectSave(page, mode);
                await run(page, entry);
                await expect(page.getByRole('status').filter({ hasText: 'Content migration cancelled because not all dirty files could be saved.' })).toBeVisible();
                await expect(confirmation(page)).toHaveCount(0);
                expect(await disk(page, root)).toEqual(before);
                expect(await logs(page)).toEqual([]);
                expect(await page.evaluate(async root => {
                    const { useWorkbenchStore } = await import('/src/store/useWorkbenchStore.ts');
                    return useWorkbenchStore.getState().tabs.find(tab => tab.path === `${root}/game.json`)?.textContent;
                }, root)).toBe(text);
            });
        }

        test(`${name}: ${entry} migration retires a pending save after same-path replacement`, async ({ page }) => {
            const { root, before } = await fixture(page, name);
            await dirty(page, root, before['game.json']);
            await injectSave(page, 'deferred');
            await run(page, entry);
            await page.evaluate(() => globalThis.__migrationDelay.started);
            await replaceSession(page, root);
            await release(page);
            expect(await disk(page, root)).toEqual(before);
            expect(await logs(page)).toEqual([]);
            await expect(confirmation(page)).toHaveCount(0);
        });
    }

    test(`${name}: migration saves current drafts and persists all accepted files`, async ({ page }) => {
        const { root, before } = await fixture(page, name);
        await dirty(page, root, before['game.json']);
        await run(page);
        await expect(confirmation(page)).toBeVisible();
        await confirmation(page).getByRole('button', { name: 'Migrate', exact: true }).click();
        await expect(page.getByRole('status').filter({ hasText: 'Content migration applied 3 file(s).' })).toBeVisible();
        const result = await disk(page, root);
        expect(JSON.parse(result['game.json'])).toMatchObject({ title: 'New saved author title', schemaVersion: 2 });
        expect(JSON.parse(result['scenes/migration_intro.json'])).toMatchObject({ schemaVersion: 2, commands: [{ text: 'Preserved intro' }, { to: 'ending' }] });
        expect(JSON.parse(result['scenes/migration_ending.json'])).toMatchObject({ schemaVersion: 2, commands: [{ text: 'Preserved ending' }] });
    });

    test(`${name}: migration discards a retired preview and confirmation`, async ({ page }) => {
        const { root, before } = await fixture(page, name);
        await deferRead(page, root);
        await run(page);
        await page.evaluate(() => globalThis.__migrationDelay.started);
        await replaceSession(page, root);
        await release(page);
        await expect(confirmation(page)).toHaveCount(0);
        expect(await logs(page)).toEqual([]);
        await run(page);
        await expect(confirmation(page)).toBeVisible();
        const previous = await logs(page);
        await replaceSession(page, root);
        await confirmation(page).getByRole('button', { name: 'Migrate', exact: true }).click();
        await expect(confirmation(page)).toHaveCount(0);
        expect(await disk(page, root)).toEqual(before);
        expect(await logs(page)).toEqual(previous);
    });

    test(`${name}: automatic opening retires obsolete confirmation and never opens its project`, async ({ page }) => {
        const { root, before } = await fixture(page, name);
        const other = await mountFixture(page, await readFixture(name));
        await page.evaluate(async root => {
            const { closeProject, executeOpenProjectInCurrentWindow } = await import('/src/store/actions/projectOpenActions.ts');
            closeProject();
            globalThis.__migrationOpen = executeOpenProjectInCurrentWindow(`${root}/game.json`, { prompt: false });
        }, root);
        await expect(confirmation(page)).toBeVisible();
        await openFixture(page, other);
        await confirmation(page).getByRole('button', { name: 'Migrate', exact: true }).click();
        expect(await page.evaluate(() => globalThis.__migrationOpen)).toEqual({ status: 'cancelled' });
        expect(await disk(page, root)).toEqual(before);
        expect(await page.evaluate(async () => (await import('/src/store/storeBootstrap.ts')).useProjectStore.getState().projectPath)).toBe(other);
    });

    test(`${name}: migration protects an external edit made after preflight`, async ({ page }) => {
        const { root, before } = await fixture(page, name);
        await run(page);
        await expect(confirmation(page)).toBeVisible();
        await page.evaluate(async root => {
            const { browserFsAdapter: fs } = await import('/src/services/fs/browserFsAdapter.ts');
            const original = fs.writeTextFile;
            fs.writeTextFile = async function (path, content, options) {
                if (path === `${root}/game.json`) {
                    fs.writeTextFile = original;
                    const game = JSON.parse(await fs.readTextFile(path));
                    await original.call(this, path, JSON.stringify({ ...game, title: 'External edit preserved' }));
                }
                return original.call(this, path, content, options);
            };
        }, root);
        await confirmation(page).getByRole('button', { name: 'Migrate', exact: true }).click();
        await expect(page.getByRole('status').filter({ hasText: 'Content migration wrote 2 file(s), but 1 file(s) changed after preview.' })).toBeVisible();
        const result = await disk(page, root);
        expect(JSON.parse(result['game.json'])).toMatchObject({ title: 'External edit preserved', schemaVersion: 1 });
        expect(result['scenes/migration_intro.json']).not.toBe(before['scenes/migration_intro.json']);
    });

    test(`${name}: migration reports partial progress and stops subsequent writes`, async ({ page }) => {
        const { root, before } = await fixture(page, name);
        await run(page);
        await expect(confirmation(page)).toBeVisible();
        await page.evaluate(async root => {
            const { browserFsAdapter: fs } = await import('/src/services/fs/browserFsAdapter.ts');
            const original = fs.writeTextFile;
            fs.writeTextFile = async function (path, ...args) {
                if (path === `${root}/scenes/migration_intro.json`) {
                    fs.writeTextFile = original;
                    throw new Error('Injected migration permission denial');
                }
                return original.call(this, path, ...args);
            };
        }, root);
        await confirmation(page).getByRole('button', { name: 'Migrate', exact: true }).click();
        await expect(page.getByRole('status').filter({ hasText: 'Content migration stopped after writing 1 file(s)' })).toBeVisible();
        const result = await disk(page, root);
        expect(JSON.parse(result['game.json']).schemaVersion).toBe(2);
        expect(result['scenes/migration_intro.json']).toBe(before['scenes/migration_intro.json']);
        expect(result['scenes/migration_ending.json']).toBe(before['scenes/migration_ending.json']);
        expect((await logs(page)).some(text => text.includes('writing 1 file(s)'))).toBe(true);
    });

    for (const fail of [false, true]) {
        test(`${name}: migration retires following writes and late ${fail ? 'failure' : 'success'} after replacement`, async ({ page }) => {
            const { root, before } = await fixture(page, name);
            const other = await mountFixture(page, await readFixture(name));
            await run(page);
            await expect(confirmation(page)).toBeVisible();
            const previous = await logs(page);
            await page.evaluate(async ({ root, fail }) => {
                const { browserFsAdapter: fs } = await import('/src/services/fs/browserFsAdapter.ts');
                const original = fs.writeTextFile;
                let release;
                let started;
                let done;
                const pending = new Promise(resolve => { release = resolve; });
                globalThis.__migrationDelay = { release, done: new Promise(resolve => { done = resolve; }), started: new Promise(resolve => { started = resolve; }) };
                fs.writeTextFile = async function (path, ...args) {
                    if (path !== `${root}/game.json`) return original.call(this, path, ...args);
                    fs.writeTextFile = original;
                    started();
                    await pending;
                    try {
                        if (fail) throw new Error('Obsolete migration write failure');
                        return await original.call(this, path, ...args);
                    } finally { done(); }
                };
            }, { root, fail });
            await confirmation(page).getByRole('button', { name: 'Migrate', exact: true }).click();
            await page.evaluate(() => globalThis.__migrationDelay.started);
            await replaceSession(page, other);
            await release(page);
            await page.evaluate(() => globalThis.__migrationDelay.done);
            const result = await disk(page, root);
            expect(result['scenes/migration_intro.json']).toBe(before['scenes/migration_intro.json']);
            expect(result['scenes/migration_ending.json']).toBe(before['scenes/migration_ending.json']);
            if (fail) expect(result['game.json']).toBe(before['game.json']);
            else expect(JSON.parse(result['game.json']).schemaVersion).toBe(2);
            expect(await logs(page)).toEqual(previous);
            expect(await page.evaluate(async () => (await import('/src/store/storeBootstrap.ts')).useProjectStore.getState().projectPath)).toBe(other);
        });
    }
}
