import { expect } from '@playwright/test';

import { dock, mountFixture, openFixture, readFixture, setup, test } from './authoringHelpers.mjs';

const saveButton = page => page.getByRole('button', { name: 'Save playtest', exact: true });

test.beforeEach(async ({ page }) => {
    page.__playtestErrors = [];
    page.on('pageerror', error => page.__playtestErrors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') page.__playtestErrors.push(message.text()); });
    await page.addInitScript(() => {
        globalThis.__playtestRejections = [];
        globalThis.addEventListener('unhandledrejection', event => globalThis.__playtestRejections.push(String(event.reason)));
    });
    await setup(page);
    await page.evaluate(async () => {
        const { useSettingsStore } = await import('/src/store/useSettingsStore.ts');
        useSettingsStore.getState().setRecoveryEnabled(false);
        useSettingsStore.getState().setAutosaveEnabled(false);
    });
});

test.afterEach(async ({ page }) => {
    expect(page.__playtestErrors).toEqual([]);
    expect(await page.evaluate(() => globalThis.__playtestRejections)).toEqual([]);
});

async function fixture(page, name) {
    const files = await readFixture(name);
    const game = JSON.parse(Buffer.from(files['game.json'], 'base64').toString('utf8'));
    const scenario = { choices: [], expectedState: {}, id: 'A', index: 0, inventory: [], name: 'Original A', scene: Object.keys(game.scenes)[0], state: {} };
    files['.zerith/playtests.json'] = Buffer.from(JSON.stringify({ scenarios: [scenario, { ...scenario, id: 'B', name: 'Original B' }], version: 1 })).toString('base64');
    const root = await mountFixture(page, files);
    await openFixture(page, root);
    await showPanel(page);
    return root;
}

async function showPanel(page) {
    await dock(page, 'playtests');
    await expect(saveButton(page)).toBeEnabled();
}

async function disk(page, root) {
    return page.evaluate(async root => {
        const { browserFsAdapter: fs } = await import('/src/services/fs/browserFsAdapter.ts');
        return JSON.parse(await fs.readTextFile(`${root}/.zerith/playtests.json`)).scenarios;
    }, root);
}

async function deferWrite(page, root, fail = false) {
    await page.evaluate(async ({ root, fail }) => {
        const { browserFsAdapter: fs } = await import('/src/services/fs/browserFsAdapter.ts');
        const original = fs.writeTextFile;
        let started;
        let release;
        let done;
        const pending = new Promise(resolve => { release = resolve; });
        globalThis.__playtestWrite = { done: new Promise(resolve => { done = resolve; }), release, started: new Promise(resolve => { started = resolve; }) };
        fs.writeTextFile = async function (candidate, ...args) {
            if (candidate !== `${root}/.zerith/playtests.json`) return original.call(this, candidate, ...args);
            fs.writeTextFile = original;
            started();
            await pending;
            try {
                if (fail) throw new Error('Injected playtest write failure');
                return await original.call(this, candidate, ...args);
            } finally { done(); }
        };
    }, { root, fail });
}

async function begin(page, root, action = 'Save playtest', fail = false) {
    await deferWrite(page, root, fail);
    await page.getByRole('button', { name: action, exact: true }).click();
    await page.evaluate(() => globalThis.__playtestWrite.started);
    await expect(saveButton(page)).toBeDisabled();
}

async function release(page) {
    await page.evaluate(async () => {
        globalThis.__playtestWrite.release();
        await globalThis.__playtestWrite.done;
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    });
    await expect(saveButton(page)).toBeEnabled();
}

async function replaceSession(page, root) {
    await page.evaluate(async root => {
        const { useProjectStore } = await import('/src/store/storeBootstrap.ts');
        if (!await useProjectStore.getState().openProjectFromManifest(`${root}/game.json`)) throw new Error('Project replacement failed');
    }, root);
}

for (const name of ['classic-vn-starter', 'example-game']) {
    test(`${name}: mid-save edits retain the persisted new scenario ID on the next save`, async ({ page }) => {
        const root = await fixture(page, name);
        await page.getByLabel('Playtest name').fill('New scenario');
        await begin(page, root);
        await page.getByLabel('Playtest name').fill('Newer draft');
        await page.getByLabel('Playtest variables').fill('{"draft_revision":2}');
        await release(page);
        await expect(page.getByLabel('Playtest name')).toHaveValue('Newer draft');
        await expect(page.getByLabel('Playtest variables')).toHaveValue('{"draft_revision":2}');
        const first = await disk(page, root);
        expect(first).toHaveLength(3);
        const id = first.find(scenario => scenario.name === 'New scenario').id;
        await saveButton(page).click();
        await expect(page.getByRole('button', { name: 'Newer draft', exact: true })).toBeVisible();
        const second = await disk(page, root);
        expect(second).toHaveLength(3);
        expect(second.find(scenario => scenario.id === id)).toMatchObject({ name: 'Newer draft', state: { draft_revision: 2 } });
        expect(second.some(scenario => scenario.name === 'New scenario')).toBe(false);
    });

    test(`${name}: choosing another scenario during save preserves the selection`, async ({ page }) => {
        const root = await fixture(page, name);
        await page.getByRole('button', { name: 'Original A', exact: true }).click();
        await page.getByLabel('Playtest name').fill('Saved A');
        await begin(page, root);
        await page.getByRole('button', { name: 'Original B', exact: true }).click();
        await release(page);
        await expect(page.getByLabel('Playtest name')).toHaveValue('Original B');
        expect((await disk(page, root)).find(scenario => scenario.id === 'A').name).toBe('Saved A');
    });

    test(`${name}: deleting a scenario retains newer edits and allows saving them again`, async ({ page }) => {
        const root = await fixture(page, name);
        await page.getByRole('button', { name: 'Original A', exact: true }).click();
        await begin(page, root, 'Delete playtest');
        await page.getByLabel('Playtest name').fill('Recovered draft');
        await release(page);
        await expect(page.getByLabel('Playtest name')).toHaveValue('Recovered draft');
        expect((await disk(page, root)).map(scenario => scenario.id)).toEqual(['B']);
        await saveButton(page).click();
        await expect(page.getByRole('button', { name: 'Recovered draft', exact: true })).toBeVisible();
        expect((await disk(page, root)).find(scenario => scenario.id === 'A').name).toBe('Recovered draft');
    });

    test(`${name}: recorded-choice capture survives a pending save`, async ({ page }) => {
        const root = await fixture(page, name);
        await page.getByRole('button', { name: 'Original A', exact: true }).click();
        await page.getByText('Route recording and result checks', { exact: true }).click();
        await begin(page, root);
        await page.evaluate(async () => {
            const { usePlaytestStore } = await import('/src/store/usePlaytestStore.ts');
            usePlaytestStore.getState().recordChoice(1);
            usePlaytestStore.getState().recordChoice(0);
        });
        await page.getByRole('button', { name: 'Use recorded choices', exact: true }).click();
        await release(page);
        await expect(page.getByLabel('Recorded choices', { exact: true })).toHaveValue('[1,0]');
        expect((await disk(page, root)).find(scenario => scenario.id === 'A').choices).toEqual([]);
        await saveButton(page).click();
        await expect(saveButton(page)).toBeEnabled();
        await expect.poll(async () => (await disk(page, root)).find(scenario => scenario.id === 'A').choices).toEqual([1, 0]);
    });

    test(`${name}: write failure preserves newer edits and exposes a current failure on retry`, async ({ page }) => {
        const root = await fixture(page, name);
        const before = await disk(page, root);
        await page.getByRole('button', { name: 'Original A', exact: true }).click();
        await begin(page, root, 'Save playtest', true);
        await page.getByLabel('Playtest name').fill('Keep failed draft');
        await release(page);
        await expect(page.getByLabel('Playtest name')).toHaveValue('Keep failed draft');
        await expect(page.getByRole('status').filter({ hasText: 'Injected playtest write failure' })).toHaveCount(0);
        expect(await disk(page, root)).toEqual(before);
        await begin(page, root, 'Save playtest', true);
        await release(page);
        await expect(page.getByRole('status').filter({ hasText: 'Injected playtest write failure' })).toBeVisible();
        await expect(page.getByLabel('Playtest name')).toHaveValue('Keep failed draft');
        await saveButton(page).click();
        await expect(page.getByRole('button', { name: 'Keep failed draft', exact: true })).toBeVisible();
    });

    test(`${name}: same-path project replacement retires the pending draft completion`, async ({ page }) => {
        const root = await fixture(page, name);
        await page.getByRole('button', { name: 'Original A', exact: true }).click();
        await begin(page, root);
        await replaceSession(page, root);
        await dock(page, 'playtests');
        await expect(page.getByLabel('Playtest name')).toHaveValue('');
        await page.getByLabel('Playtest name').fill('Successor draft');
        await release(page);
        await expect(page.getByLabel('Playtest name')).toHaveValue('Successor draft');
        expect((await disk(page, root)).find(scenario => scenario.id === 'A').name).toBe('Original A');
    });
}
