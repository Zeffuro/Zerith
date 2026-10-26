import { expect } from '@playwright/test';
import { dock, mountFixture, setup, test } from './authoringHelpers.mjs';
import { cleanup, coherent, count, done, first, fixture, frames, gate, idle, install, manual, release,
    second, snapshot, started, update } from './referenceScannerOwnershipHelpers.mjs';

test.beforeEach(async ({ page }) => {
    page.__referenceErrors = [];
    page.__referenceFailures = [];
    page.on('pageerror', error => page.__referenceErrors.push(error.message));
    page.on('console', message => {
        if (message.type() !== 'error') return;
        if (message.text().includes('Reference ownership injected failure')) page.__referenceFailures.push(message.text());
        else page.__referenceErrors.push(message.text());
    });
    await page.addInitScript(() => {
        globalThis.__referenceRejections = [];
        globalThis.addEventListener('unhandledrejection', event => globalThis.__referenceRejections.push(String(event.reason)));
    });
    await setup(page);
    await page.evaluate(async () => {
        const { useSettingsStore } = await import('/src/store/useSettingsStore.ts');
        useSettingsStore.getState().setRecoveryEnabled(false);
        useSettingsStore.getState().setAutosaveEnabled(false);
    });
    await install(page);
});

test.afterEach(async ({ page }) => {
    await cleanup(page);
    expect(page.__referenceErrors).toEqual([]);
    expect(await page.evaluate(() => globalThis.__referenceRejections)).toEqual([]);
    await page.goto('about:blank');
});

async function fresh(page, before) {
    await expect.poll(() => count(page)).toBeGreaterThan(before);
    await idle(page);
    await frames(page);
}

async function graph(page) {
    return page.evaluate(() => globalThis.__referenceOwned.references.getState().getAssetDependencyGraph());
}

async function clearSession(page, root) {
    return page.evaluate(root => {
        const owned = globalThis.__referenceOwned;
        const before = owned.projects.getState();
        owned.projects.setState({ projectPath: root, projectGeneration: before.projectGeneration + 1 });
        return owned.capture(owned.references.getState());
    }, root);
}

const empty = { inventory: [], result: { assetFiles: {}, assets: {}, characters: {}, items: {}, variables: {} } };

for (const name of ['classic-vn-starter', 'example-game']) {
    test(`${name}: item-only image change updates used and unused classifications`, async ({ page }) => {
        const { root } = await fixture(page, name);
        await dock(page, 'asset_dependencies');
        await expect(page.getByTitle(`Organize ${first}`, { exact: true })).toBeEnabled();
        const before = await count(page);
        await update(page, 'items');
        await fresh(page, before);
        const value = await graph(page);
        expect(value.used.find(entry => entry.assetUrl === second)?.references).toEqual([
            expect.objectContaining({ commandType: 'item.imageUrl', filePath: `${root}/data/items.json`, path: ['referenceOwner', 'imageUrl'] }),
        ]);
        expect(value.unused).toContain(first);
        expect(value.unused).not.toContain(second);
        expect(value.used.some(entry => entry.assetUrl === first)).toBe(false);
        await coherent(page);
    });

    test(`${name}: manifest-only replacement updates item and script navigation sources`, async ({ page }) => {
        const { root } = await fixture(page, name);
        const before = await count(page);
        const sceneName = await page.evaluate(() => {
            const owned = globalThis.__referenceOwned;
            const state = owned.projects.getState();
            const sceneName = Object.keys(state.scenes)[0];
            owned.projects.setState({ scenes: { ...state.scenes, [sceneName]: [{ type: 'set', key: 'referenceManifest', value: 1 }] },
                macros: { ...state.macros, referenceOwner: [{ type: 'set', key: 'referenceMacro', value: 1 }] } });
            return sceneName;
        });
        await fresh(page, before);
        const start = await count(page);
        await page.evaluate(sceneName => {
            const owned = globalThis.__referenceOwned;
            const manifest = owned.projects.getState().manifest;
            owned.projects.setState({ manifest: { ...manifest, items: '/data/changed-items.json', macros: '/data/changed-macros.json',
                scenes: { ...manifest.scenes, [sceneName]: '/scenes/changed-source.json' } } });
        }, sceneName);
        await fresh(page, start);
        const value = await snapshot(page);
        expect(value.result.assetFiles[first][0].filePath).toBe(`${root}/data/changed-items.json`);
        expect(value.result.variables.referenceManifest.writes[0].filePath).toBe(`${root}/scenes/changed-source.json`);
        expect(value.result.variables.referenceMacro.writes[0].filePath).toBe(`${root}/data/changed-macros.json`);
        await coherent(page);
    });

    for (const input of ['scenes', 'macros', 'characters', 'treeRevision', 'projectGeneration']) {
        test(`${name}: ${input} independently schedules an automatic scan`, async ({ page }) => {
            const { root } = await fixture(page, name);
            const before = await count(page);
            const held = await gate(page, root);
            await update(page, input, 'referenceInput');
            await started(page, held);
            if (input === 'projectGeneration') expect(await snapshot(page)).toEqual(empty);
            await release(page, held);
            await fresh(page, before);
            const value = await snapshot(page);
            if (input === 'scenes' || input === 'macros') expect(value.result.variables.referenceInput.writes).toHaveLength(1);
            if (input === 'characters') expect(value.result.assetFiles['/assets/referenceInput'][0].commandType).toBe('character.portraitUrl');
            await coherent(page);
        });
    }

    for (const replacement of ['same path', 'different path', 'close', 'A to B to A']) {
        test(`${name}: ${replacement} clears old graph synchronously and retires held manual reads`, async ({ page }) => {
            const { files, root } = await fixture(page, name);
            const other = await mountFixture(page, files);
            const old = await gate(page, root);
            const task = await manual(page);
            await started(page, old);
            const next = replacement === 'different path' ? other : replacement === 'close' ? undefined : root;
            if (replacement === 'A to B to A') expect(await clearSession(page, other)).toEqual(empty);
            expect(await clearSession(page, next)).toEqual(empty);
            expect(await graph(page)).toEqual({ missing: [], unused: [], used: [] });
            const successor = next ? await gate(page, next) : undefined;
            if (successor !== undefined) await started(page, successor);
            const baseline = await count(page);
            await release(page, old);
            await done(page, task);
            expect(await count(page)).toBe(baseline);
            expect(await snapshot(page)).toEqual(empty);
            if (successor !== undefined) {
                await release(page, successor);
                await fresh(page, baseline);
                expect((await snapshot(page)).result.assetFiles[first][0].filePath).toBe(`${next}/data/items.json`);
            }
            await coherent(page);
        });
    }

    for (const order of ['automatic then manual', 'manual then automatic', 'manual then manual']) {
        test(`${name}: ${order} shares request order while successor is held`, async ({ page }) => {
            const { root } = await fixture(page, name);
            const old = await gate(page, root);
            let oldTask;
            if (order.startsWith('automatic')) await update(page, 'items', first);
            else oldTask = await manual(page);
            await started(page, old);
            if (order.endsWith('automatic')) await update(page, 'items', second);
            const successor = await gate(page, root);
            let successorTask;
            if (order.endsWith('automatic')) await started(page, successor);
            else { successorTask = await manual(page); await started(page, successor); }
            const baseline = await count(page);
            const prior = await snapshot(page);
            await release(page, old);
            if (oldTask !== undefined) await done(page, oldTask);
            expect(await count(page)).toBe(baseline);
            expect(await snapshot(page)).toEqual(prior);
            await release(page, successor);
            if (successorTask !== undefined) await done(page, successorTask);
            await fresh(page, baseline);
            const expectedAsset = order.endsWith('automatic') ? second : first;
            expect((await snapshot(page)).result.assetFiles[expectedAsset][0].commandType).toBe('item.imageUrl');
            await coherent(page);
        });
    }

    test(`${name}: reverse manual completion cannot restore the older inventory or result`, async ({ page }) => {
        const { root } = await fixture(page, name);
        const old = await gate(page, root);
        const oldTask = await manual(page);
        await started(page, old);
        await page.evaluate(async root => {
            const { browserFsAdapter: fs } = await import('/src/services/fs/browserFsAdapter.ts');
            await fs.writeTextFile(`${root}/assets/reference-added.txt`, 'successor');
        }, root);
        const successor = await manual(page);
        await done(page, successor);
        const baseline = await count(page);
        const current = await snapshot(page);
        expect(current.inventory).toContain('/assets/reference-added.txt');
        await release(page, old);
        await done(page, oldTask);
        expect(await count(page)).toBe(baseline);
        expect(await snapshot(page)).toEqual(current);
        await coherent(page);
    });

    test(`${name}: obsolete descriptor read cannot publish during a held successor`, async ({ page }) => {
        const { root } = await fixture(page, name);
        await page.evaluate(async root => {
            const { browserFsAdapter: fs } = await import('/src/services/fs/browserFsAdapter.ts');
            await fs.writeTextFile(`${root}/assets/reference-owned.atlas.json`, JSON.stringify({ source: 'reference-owner-a.png' }));
        }, root);
        const old = await gate(page, root, 'readTextFile', false, '/assets/reference-owned.atlas.json');
        await page.evaluate(() => {
            const owned = globalThis.__referenceOwned;
            owned.projects.setState({ characters: { ...owned.projects.getState().characters,
                referenceOwner: { spritesheet: { atlasUrl: '/assets/reference-owned.atlas.json' } } } });
        });
        await started(page, old);
        await update(page, 'items', second);
        const successor = await gate(page, root);
        await started(page, successor);
        const baseline = await count(page);
        const previous = await snapshot(page);
        await release(page, old);
        await frames(page);
        expect(await count(page)).toBe(baseline);
        expect(await snapshot(page)).toEqual(previous);
        await release(page, successor);
        await fresh(page, baseline);
        const current = await snapshot(page);
        expect(current.result.assetFiles[first].some(entry => entry.commandType === 'character.spritesheet.source')).toBe(true);
        expect(current.result.assetFiles[second][0].commandType).toBe('item.imageUrl');
        await coherent(page);
    });

    test(`${name}: caller ownership remains an additional publication condition`, async ({ page }) => {
        const { root } = await fixture(page, name);
        const held = await gate(page, root);
        const task = await manual(page);
        await started(page, held);
        await page.evaluate(task => { globalThis.__referenceOwned.tasks[task].current = false; }, task);
        const baseline = await count(page);
        await release(page, held);
        await done(page, task);
        expect(await count(page)).toBe(baseline);
        const next = await manual(page);
        await done(page, next);
        expect(await count(page)).toBe(baseline + 1);
        await coherent(page);
    });

    test(`${name}: synchronous result listener replaces session without a retired second publication`, async ({ page }) => {
        await fixture(page, name);
        const before = await count(page);
        await page.evaluate(() => {
            const owned = globalThis.__referenceOwned;
            let stop;
            stop = owned.references.subscribe((state, previous) => {
                if (state.result === previous.result || state.assetInventory.length === 0) return;
                stop();
                const project = owned.projects.getState();
                owned.projects.setState({ projectPath: undefined, projectGeneration: project.projectGeneration + 1 });
            });
            owned.restores.push(stop);
        });
        const task = await manual(page);
        await done(page, task);
        expect(await snapshot(page)).toEqual(empty);
        const events = await page.evaluate(before => globalThis.__referenceOwned.events.slice(before), before);
        expect(events).toHaveLength(2);
        expect(events[0].inventory).toContain(first);
        expect(events[1]).toMatchObject(empty);
        await coherent(page);
    });

    test(`${name}: metadata UI refresh participates in shared order`, async ({ page }) => {
        const { root } = await fixture(page, name);
        await dock(page, 'asset_dependencies');
        const organize = page.getByTitle(`Organize ${first}`, { exact: true });
        await expect(organize).toBeEnabled();
        const old = await gate(page, root);
        const task = await manual(page);
        await started(page, old);
        await organize.click();
        await page.getByRole('dialog').getByLabel('Tags', { exact: true }).fill('reference-owner');
        const successor = await gate(page, root);
        await page.getByRole('button', { name: 'Save metadata', exact: true }).click();
        await started(page, successor);
        const baseline = await count(page);
        await release(page, old);
        await done(page, task);
        expect(await count(page)).toBe(baseline);
        await release(page, successor);
        await fresh(page, baseline);
        await expect(page.getByRole('dialog')).toHaveCount(0);
        await expect(page.getByText('#reference-owner', { exact: true })).toBeVisible();
        await coherent(page);
    });

    for (const retired of [false, true]) {
        test(`${name}: ${retired ? 'retired' : 'current'} automatic rejection is handled and a fresh scan recovers`, async ({ page }) => {
            const { root } = await fixture(page, name);
            const failed = await gate(page, root, 'join', true);
            await update(page, 'items', second);
            await started(page, failed);
            const reportsBefore = await page.evaluate(() => globalThis.__referenceOwned.reports.length);
            const failuresBefore = page.__referenceFailures.length;
            if (retired) await update(page, 'items', first);
            await release(page, failed);
            await idle(page);
            await frames(page);
            if (retired) {
                expect(await page.evaluate(() => globalThis.__referenceOwned.reports.length)).toBe(reportsBefore);
                expect(page.__referenceFailures).toHaveLength(failuresBefore);
            }
            else await expect.poll(() => page.evaluate(() => globalThis.__referenceOwned.reports.filter(entry => entry.type === 'error' && entry.text.includes('Reference ownership injected failure')).length)).toBe(1);
            const before = await count(page);
            await update(page, 'items', second);
            await fresh(page, before);
            expect((await snapshot(page)).result.assetFiles[second][0].commandType).toBe('item.imageUrl');
            expect(await page.evaluate(() => globalThis.__referenceRejections)).toEqual([]);
            await coherent(page);
        });
    }
}
