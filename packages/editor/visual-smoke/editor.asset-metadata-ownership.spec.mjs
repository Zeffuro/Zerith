import { expect } from '@playwright/test';

import { dock, mountFixture, openFixture, readFixture, setup, test } from './authoringHelpers.mjs';

const asset = '/assets/ownership-a.svg';
const metadataFile = 'assets/.zerith-library.json';
const library = { assets: { [asset]: { collections: ['Original'], tags: ['keep'] } }, schemaVersion: 1, type: 'zerith.assetLibrary' };
const dialog = page => page.getByRole('dialog', { name: 'Organize Asset', exact: true });
const organize = page => page.getByTitle(`Organize ${asset}`, { exact: true });
const visible = page => page.getByRole('button', { name: /^Organize visible assets \(/u });

test.beforeEach(async ({ page }) => {
    page.__assetErrors = [];
    page.on('pageerror', error => page.__assetErrors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') page.__assetErrors.push(message.text()); });
    await page.addInitScript(() => {
        globalThis.__assetRejections = [];
        globalThis.addEventListener('unhandledrejection', event => globalThis.__assetRejections.push(String(event.reason)));
    });
    await setup(page);
    await page.evaluate(async () => {
        const { useSettingsStore } = await import('/src/store/useSettingsStore.ts');
        useSettingsStore.getState().setRecoveryEnabled(false);
        useSettingsStore.getState().setAutosaveEnabled(false);
    });
});
test.afterEach(async ({ page }) => {
    expect(page.__assetErrors).toEqual([]);
    expect(await page.evaluate(() => globalThis.__assetRejections)).toEqual([]);
});

async function fixture(page, name, metadata = JSON.stringify(library)) {
    const files = await readFixture(name);
    for (const letter of ['a', 'b']) files[`assets/ownership-${letter}.svg`] = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>').toString('base64');
    if (metadata !== undefined) files[metadataFile] = Buffer.from(metadata).toString('base64');
    const root = await mountFixture(page, files);
    await openFixture(page, root);
    await dock(page, 'asset_dependencies');
    await expect(page.getByText('Asset Dependencies', { exact: true })).toBeVisible();
    return root;
}
async function disk(page, root) {
    return page.evaluate(async ({ root, metadataFile }) => {
        const { browserFsAdapter: fs } = await import('/src/services/fs/browserFsAdapter.ts');
        return fs.readTextFile(`${root}/${metadataFile}`);
    }, { root, metadataFile });
}
async function writeDisk(page, root, text) {
    await page.evaluate(async ({ root, metadataFile, text }) => {
        const { browserFsAdapter: fs } = await import('/src/services/fs/browserFsAdapter.ts');
        await fs.writeTextFile(`${root}/${metadataFile}`, text);
    }, { root, metadataFile, text });
}
async function logs(page) {
    return page.evaluate(async () => {
        const { useConsoleStore } = await import('/src/store/useConsoleStore.ts');
        return useConsoleStore.getState().messages.filter(message => /Asset (?:library metadata|metadata saved)|Updated asset organization|Updated metadata|Added \d+ visible assets/u.test(message.text))
            .map(message => ({ text: message.text, type: message.type }));
    });
}
async function clearLogs(page) {
    await page.evaluate(async () => {
        const { useConsoleStore } = await import('/src/store/useConsoleStore.ts');
        useConsoleStore.getState().clear();
    });
}
async function edit(page, tags = 'keep, draft') {
    await expect(organize(page)).toBeEnabled();
    await organize(page).click();
    await expect(dialog(page)).toBeVisible();
    await dialog(page).getByLabel('Tags', { exact: true }).fill(tags);
}
async function refreshMetadata(page) {
    await page.evaluate(async () => {
        const { useReferenceStore } = await import('/src/store/useReferenceStore.ts');
        const store = useReferenceStore.getState();
        store.setAssetInventory([...store.assetInventory]);
    });
}
async function retry(page) {
    const scope = await page.getByRole('dialog').count() ? page.getByRole('dialog') : page;
    await scope.getByRole('button', { name: 'Retry metadata load', exact: true }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Asset metadata could not' })).toHaveCount(0);
}
async function injectReadFailure(page, root) {
    await page.evaluate(async ({ root, metadataFile }) => {
        const { browserFsAdapter: fs } = await import('/src/services/fs/browserFsAdapter.ts');
        const original = fs.readTextFile;
        globalThis.__restoreAssetRead = () => { fs.readTextFile = original; };
        fs.readTextFile = function (path, ...args) {
            return path === `${root}/${metadataFile}` ? Promise.reject(new Error('Asset metadata permission denied')) : original.call(this, path, ...args);
        };
    }, { root, metadataFile });
}
async function delay(page, root, operation, fail = false) {
    await page.evaluate(async ({ root, metadataFile, operation, fail }) => {
        const { browserFsAdapter: fs } = await import('/src/services/fs/browserFsAdapter.ts');
        const method = operation === 'read' ? 'readTextFile' : 'writeTextFile';
        const original = fs[method];
        let started;
        let release;
        let done;
        const pending = new Promise(resolve => { release = resolve; });
        globalThis.__assetDelay = { release, started: new Promise(resolve => { started = resolve; }), done: new Promise(resolve => { done = resolve; }), calls: 0 };
        fs[method] = async function (path, ...args) {
            if (path !== `${root}/${metadataFile}`) return original.call(this, path, ...args);
            fs[method] = original;
            globalThis.__assetDelay.calls++;
            try {
                const value = operation === 'read' ? await original.call(this, path, ...args) : undefined;
                started();
                await pending;
                if (fail) throw new Error('Retired asset metadata failure');
                return operation === 'read' ? value : await original.call(this, path, ...args);
            } finally { done(); }
        };
    }, { root, metadataFile, operation, fail });
}
async function started(page) { await page.evaluate(() => globalThis.__assetDelay.started); }
async function release(page) {
    await page.evaluate(async () => {
        globalThis.__assetDelay.release();
        await globalThis.__assetDelay.done;
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    });
}
async function replace(page, root, target, successor) {
    if (target === 'B' || target === 'B-A') await openFixture(page, successor);
    if (target === 'B-A') await openFixture(page, root);
    if (target === 'same') await page.evaluate(async root => {
        const { useProjectStore } = await import('/src/store/storeBootstrap.ts');
        if (!await useProjectStore.getState().openProjectFromManifest(`${root}/game.json`)) throw new Error('Asset test project replacement failed');
    }, root);
    if (target === 'close') await page.evaluate(async () => {
        const { executeCloseProjectAction } = await import('/src/store/actions/projectOpenActions.ts');
        executeCloseProjectAction();
    });
    if (target === 'unmount') await page.evaluate(async () => {
        const { useEditorStore } = await import('/src/store/useEditorStore.ts');
        const editor = useEditorStore.getState();
        const json = structuredClone(editor.captureDockLayoutJson());
        function remove(node) {
            if (node.children) node.children = node.children.filter(child => child.id !== 'asset_dependencies');
            for (const child of node.children ?? []) remove(child);
        }
        remove(json.layout);
        editor.setDockLayoutJson(json);
    });
}

for (const name of ['classic-vn-starter', 'example-game']) {
    test(`${name}: unreadable metadata blocks mutation and retry preserves labels and an open draft`, async ({ page }) => {
        const root = await fixture(page, name);
        await edit(page, 'retained draft');
        await injectReadFailure(page, root);
        await refreshMetadata(page);
        await expect(page.getByRole('alert').filter({ hasText: 'permission denied' })).toBeVisible();
        await expect(dialog(page).getByRole('button', { name: 'Save metadata', exact: true })).toBeDisabled();
        await expect(dialog(page).getByLabel('Tags', { exact: true })).toHaveValue('retained draft');
        await page.evaluate(() => globalThis.__restoreAssetRead());
        expect(JSON.parse(await disk(page, root))).toEqual(library);
        await retry(page);
        await expect(dialog(page).getByLabel('Tags', { exact: true })).toHaveValue('retained draft');
        await dialog(page).getByRole('button', { name: 'Save metadata', exact: true }).click();
        await expect(dialog(page)).toHaveCount(0);
        expect(JSON.parse(await disk(page, root)).assets[asset]).toEqual({ collections: ['Original'], tags: ['retained draft'] });
    });

    test(`${name}: invalid JSON and external edits are protected while save drafts survive failure and refresh`, async ({ page }) => {
        const root = await fixture(page, name, '{broken');
        await expect(page.getByRole('alert').filter({ hasText: 'invalid JSON' })).toBeVisible();
        await expect(organize(page)).toBeDisabled();
        expect(await disk(page, root)).toBe('{broken');
        await writeDisk(page, root, JSON.stringify(library));
        await retry(page);
        await edit(page, 'draft after refresh');
        const external = { ...library, assets: { ...library.assets, '/assets/external.svg': { tags: ['external'], collections: [] } } };
        await writeDisk(page, root, JSON.stringify(external));
        await dialog(page).getByRole('button', { name: 'Save metadata', exact: true }).click();
        await expect(page.getByRole('alert').filter({ hasText: 'Asset metadata could not' })).toBeVisible();
        await expect(dialog(page).getByLabel('Tags', { exact: true })).toHaveValue('draft after refresh');
        expect(JSON.parse(await disk(page, root))).toEqual(external);
        await retry(page);
        await expect(dialog(page).getByLabel('Tags', { exact: true })).toHaveValue('draft after refresh');
        await dialog(page).getByRole('button', { name: 'Save metadata', exact: true }).click();
        await expect(dialog(page)).toHaveCount(0);
        const saved = JSON.parse(await disk(page, root));
        expect(saved.assets['/assets/external.svg']).toEqual({ tags: ['external'], collections: [] });
        expect(saved.assets[asset].tags).toEqual(['draft after refresh']);
    });

    test(`${name}: confirmed missing metadata creates a new library`, async ({ page }) => {
        const files = await readFixture(name);
        files['assets/ownership-a.svg'] = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>').toString('base64');
        const root = await mountFixture(page, files);
        await openFixture(page, root);
        await dock(page, 'asset_dependencies');
        await edit(page, 'created');
        await dialog(page).getByRole('button', { name: 'Save metadata', exact: true }).click();
        await expect(dialog(page)).toHaveCount(0);
        expect(JSON.parse(await disk(page, root)).assets[asset]).toEqual({ collections: [], tags: ['created'] });
    });

    for (const order of ['single', 'bulk']) test(`${name}: ${order} mutation disables overlapping controls and preserves a subsequent edit`, async ({ page }) => {
        const root = await fixture(page, name);
        await expect(organize(page)).toBeEnabled();
        if (order === 'single') await edit(page, 'single');
        else {
            await visible(page).click();
            await page.getByRole('dialog', { name: 'Organize Visible Assets', exact: true }).getByLabel('Collections', { exact: true }).fill('Bulk');
        }
        await delay(page, root, 'write');
        await page.getByRole('dialog').getByRole('button', { name: order === 'single' ? 'Save metadata' : 'Apply labels', exact: true }).click();
        await started(page);
        await expect(organize(page)).toBeDisabled();
        await expect(page.getByLabel('Collection name for visible assets')).toBeDisabled();
        await expect(page.getByRole('button', { name: 'Organizing assets...', exact: true })).toBeDisabled();
        await release(page);
        await expect(page.getByRole('dialog')).toHaveCount(0);
        if (order === 'single') {
            await page.getByLabel('Collection name for visible assets').fill('Bulk');
            await page.getByTitle('Add visible assets to collection', { exact: true }).click();
            await expect(page.getByLabel('Collection name for visible assets')).toBeEnabled();
            await expect(page.getByLabel('Collection name for visible assets')).toHaveValue('');
            expect(JSON.parse(await disk(page, root)).assets[asset].collections).toContain('Bulk');
        } else {
            await edit(page, 'single');
            await dialog(page).getByRole('button', { name: 'Save metadata', exact: true }).click();
            await expect(dialog(page)).toHaveCount(0);
        }
        expect(JSON.parse(await disk(page, root)).assets[asset]).toEqual({ collections: ['Bulk', 'Original'], tags: ['single'] });
    });

    for (const operation of ['read', 'write']) for (const fail of [false, true]) {
        test(`${name}: retires deferred metadata ${operation} ${fail ? 'error' : 'success'} across replacement and close`, async ({ page }) => {
            const root = await fixture(page, name);
            const successor = await fixture(page, name);
            for (const target of ['B', 'B-A', 'same', 'close']) {
                await openFixture(page, root);
                await dock(page, 'asset_dependencies');
                await expect(organize(page)).toBeEnabled();
                await clearLogs(page);
                if (operation === 'write') await edit(page, `retired ${target}`);
                await delay(page, root, operation, fail);
                if (operation === 'read') await refreshMetadata(page);
                else await dialog(page).getByRole('button', { name: 'Save metadata', exact: true }).click();
                await started(page);
                await replace(page, root, target, successor);
                await expect(dialog(page)).toHaveCount(0);
                if (target !== 'close') await expect(organize(page)).toBeEnabled();
                const currentLogs = await logs(page);
                await release(page);
                expect(await logs(page)).toEqual(currentLogs);
                await expect(page.getByRole('alert').filter({ hasText: 'Asset metadata could not' })).toHaveCount(0);
                expect(JSON.parse(await disk(page, successor))).toEqual(library);
            }
        });
    }

    test(`${name}: retires a queued same-path write and a pending write after panel unmount`, async ({ page }) => {
        const root = await fixture(page, name);
        await edit(page, 'queued draft');
        await clearLogs(page);
        await delay(page, root, 'write');
        await page.evaluate(async ({ root, metadataFile }) => {
            const { fsWriteTextFile } = await import('/src/services/fs/index.ts');
            const { browserFsAdapter: fs } = await import('/src/services/fs/browserFsAdapter.ts');
            globalThis.__assetBlocker = fsWriteTextFile(`${root}/${metadataFile}`, await fs.readTextFile(`${root}/${metadataFile}`));
        }, { root, metadataFile });
        await started(page);
        await dialog(page).getByRole('button', { name: 'Save metadata', exact: true }).click();
        await expect(dialog(page).getByRole('button', { name: 'Saving...' })).toBeDisabled();
        await replace(page, root, 'same');
        await release(page);
        await page.evaluate(() => globalThis.__assetBlocker);
        expect(JSON.parse(await disk(page, root))).toEqual(library);
        expect(await logs(page)).toEqual([]);
        await edit(page, 'unmounted');
        await delay(page, root, 'write', true);
        await dialog(page).getByRole('button', { name: 'Save metadata', exact: true }).click();
        await started(page);
        await replace(page, root, 'unmount');
        await expect(dialog(page)).toHaveCount(0);
        await release(page);
        expect(await logs(page)).toEqual([]);
    });
}
