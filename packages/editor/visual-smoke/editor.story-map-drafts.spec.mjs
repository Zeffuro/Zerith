import { expect } from '@playwright/test';

import { dock, mountFixture, openFixture, readFixture, replaceJson, setup, test } from './authoringHelpers.mjs';

const jump = to => ({ type: 'jump', to });
const call = name => ({ type: 'call', name });
const encode = value => Buffer.from(JSON.stringify(value)).toString('base64');

test.beforeEach(async ({ page }) => {
    page.__storyMapErrors = [];
    page.on('pageerror', error => page.__storyMapErrors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') page.__storyMapErrors.push(message.text()); });
    await page.addInitScript(() => {
        globalThis.__storyMapRejections = [];
        globalThis.addEventListener('unhandledrejection', event => globalThis.__storyMapRejections.push(String(event.reason)));
    });
    await setup(page);
});

test.afterEach(async ({ page }) => {
    expect(page.__storyMapErrors).toEqual([]);
    expect(await page.evaluate(() => globalThis.__storyMapRejections)).toEqual([]);
});

async function fixture(page, name) {
    const files = await readFixture(name);
    replaceJson(files, 'game.json', game => ({ ...game, startScene: 'loaded_start', scenes: {
        loaded_start: [call('loaded_macro'), jump('loaded_end')], loaded_end: [],
    }, macros: { loaded_macro: [jump('loaded_end')] } }));
    files['scenes/map-new.json'] = encode({ commands: [jump('disk_scene_target')] });
    files['scenes/map-retarget.json'] = encode({ commands: [jump('retarget_scene_target')] });
    files['data/map-macros.json'] = encode({ disk_macro: [jump('disk_macro_target')] });
    files['data/map-retarget-macros.json'] = encode({ retarget_macro: [jump('retarget_macro_target')] });
    const root = await mountFixture(page, files);
    await openFixture(page, root);
    await showMap(page);
    const disk = await diskTexts(page, root);
    return { root, disk, manifest: JSON.parse(disk['game.json']) };
}

async function showMap(page) {
    await dock(page, 'story_map');
    await expect(page.getByRole('region', { name: 'Story map', exact: true })).toBeVisible();
    const maximize = page.locator('.flexlayout__tabset_tabbar_outer').filter({ hasText: 'Story Map' }).getByTitle('Maximize tab set');
    if (await maximize.count()) await maximize.click();
    await page.getByLabel('Macros', { exact: true }).check();
}

async function diskTexts(page, root) {
    return page.evaluate(async root => {
        const { browserFsAdapter: fs } = await import('/src/services/fs/browserFsAdapter.ts');
        const names = ['game.json', 'scenes/map-new.json', 'scenes/map-retarget.json', 'data/map-macros.json', 'data/map-retarget-macros.json'];
        return Object.fromEntries(await Promise.all(names.map(async name => [name, await fs.readTextFile(`${root}/${name}`)])));
    }, root);
}

async function draft(page, root, value, relative = 'game.json') {
    const text = typeof value === 'string' ? value : JSON.stringify(value, undefined, 4);
    return page.evaluate(async ({ root, relative, text }) => {
        const { openProjectEntry } = await import('/src/services/openProjectEntry/index.ts');
        const { useWorkbenchStore } = await import('/src/store/useWorkbenchStore.ts');
        const path = `${root}/${relative}`;
        let tab = useWorkbenchStore.getState().tabs.find(tab => tab.path === path);
        if (!tab) {
            await openProjectEntry(path, relative.split('/').at(-1), { forceView: 'json' });
            tab = useWorkbenchStore.getState().tabs.find(tab => tab.path === path);
        }
        if (!tab) throw new Error(`No workbench tab for ${path}`);
        useWorkbenchStore.getState().updateTabContent(tab.id, text);
        return { id: tab.id, text };
    }, { root, relative, text });
}

async function options(page) {
    return page.getByLabel('Go to story node').locator('option').evaluateAll(options => options.map(option => option.value).filter(Boolean));
}

async function sourceState(page) {
    return page.evaluate(async () => {
        const { useWorkbenchStore } = await import('/src/store/useWorkbenchStore.ts');
        const { tabs, activeTabId } = useWorkbenchStore.getState();
        const tab = tabs.find(tab => tab.id === activeTabId);
        return { count: tabs.filter(candidate => candidate.path === tab?.path).length, dirty: tab?.dirty, id: tab?.id,
            path: tab?.path, selection: tab?.jsonSelectionPath, text: tab?.textContent };
    });
}

async function assertNodes(page, expected) {
    await expect.poll(async () => (await options(page)).sort()).toEqual(expected.toSorted());
}

async function delayRead(page, path) {
    await page.evaluate(async path => {
        const { browserFsAdapter: fs } = await import('/src/services/fs/browserFsAdapter.ts');
        const original = fs.readTextFile;
        let started;
        let release;
        const pending = new Promise(resolve => { release = resolve; });
        globalThis.__storyMapDelay = { release, started: new Promise(resolve => { started = resolve; }) };
        fs.readTextFile = async function (candidate, ...args) {
            if (candidate !== path) return original.call(this, candidate, ...args);
            fs.readTextFile = original;
            const text = await original.call(this, candidate, ...args);
            started();
            await pending;
            return text;
        };
    }, path);
}

for (const name of ['classic-vn-starter', 'example-game']) {
    test(`${name}: maps unsaved inline membership and opens exact nested manifest source`, async ({ page }) => {
        const { root, disk, manifest } = await fixture(page, name);
        const value = { ...manifest, startScene: 'draft_start', scenes: {
            draft_start: { commands: [{ type: 'choice', id: 'Draft fork', options: [
                { label: 'Draft nested route', commands: [call('draft_macro'), jump('draft_end')] },
            ] }] }, draft_end: [], unused_draft: [],
        }, macros: { draft_macro: [jump('draft_end')] } };
        const saved = await draft(page, root, value);
        await page.evaluate(async () => {
            const { useWorkbenchStore } = await import('/src/store/useWorkbenchStore.ts');
            useWorkbenchStore.getState().setLastManifestView('timeline');
        });
        await showMap(page);
        const choice = 'choice:scene:draft_start:[0]';
        await assertNodes(page, ['scene:draft_start', 'scene:draft_end', 'scene:unused_draft', 'macro:draft_macro', choice]);
        await page.getByLabel('Go to story node').selectOption('scene:draft_start');
        await expect(page.getByRole('button', { name: 'scene draft_start', exact: true })).toBeVisible();
        await page.getByLabel('Go to story node').selectOption(choice);
        const branch = page.getByRole('region', { name: 'Story map', exact: true }).locator('div')
            .filter({ has: page.getByText('Draft fork → draft_end: Draft nested route', { exact: true }) }).last();
        await branch.getByRole('button', { name: 'Open command', exact: true }).click();
        await expect.poll(() => sourceState(page)).toEqual({ ...saved, count: 1, dirty: true, path: `${root}/game.json`,
            selection: ['scenes', 'draft_start', 'commands', 0, 'options', 0, 'commands', 1] });
        expect(await page.evaluate(async () => {
            const { useWorkbenchStore } = await import('/src/store/useWorkbenchStore.ts');
            return useWorkbenchStore.getState().lastManifestView;
        })).toBe('json');
        await showMap(page);
        await page.getByLabel('Go to story node').selectOption('macro:draft_macro');
        await page.getByRole('button', { name: 'Open source', exact: true }).click();
        await expect.poll(() => sourceState(page)).toMatchObject({ ...saved, dirty: true, selection: ['macros', 'draft_macro'] });
        const next = { ...value, startScene: 'draft_end', scenes: { unused_draft: [], draft_end: [] }, macros: {} };
        await draft(page, root, next);
        await showMap(page);
        await assertNodes(page, ['scene:draft_end', 'scene:unused_draft']);
        await page.getByLabel('Go to story node').selectOption('scene:unused_draft');
        await expect(page.getByRole('button', { name: 'scene unused_draft, unreachable', exact: true })).toBeVisible();
        expect(await diskTexts(page, root)).toEqual(disk);
    });

    test(`${name}: loads new external descriptors and retains dirty external precedence after retarget`, async ({ page }) => {
        const { root, disk, manifest } = await fixture(page, name);
        const value = { ...manifest, startScene: 'external', scenes: { external: '/scenes/map-new.json' }, macros: '/data/map-macros.json' };
        await draft(page, root, value);
        await showMap(page);
        await assertNodes(page, ['scene:external', 'scene:disk_scene_target', 'macro:disk_macro', 'scene:disk_macro_target']);
        await page.getByLabel('Go to story node').selectOption('scene:external');
        await page.getByRole('button', { name: 'Open source', exact: true }).click();
        await expect.poll(() => page.evaluate(async () => {
            const { useWorkbenchStore } = await import('/src/store/useWorkbenchStore.ts');
            return useWorkbenchStore.getState().activeTab()?.kind;
        })).toBe('script');
        await draft(page, root, { commands: [call('draft_external_macro'), jump('draft_external_target')] }, 'scenes/map-new.json');
        await draft(page, root, { draft_external_macro: [jump('draft_macro_target')] }, 'data/map-macros.json');
        await showMap(page);
        await assertNodes(page, ['scene:external', 'scene:draft_external_target', 'macro:draft_external_macro', 'scene:draft_macro_target']);
        await draft(page, root, { ...value, scenes: { external: '/scenes/map-retarget.json' }, macros: '/data/map-retarget-macros.json' });
        await showMap(page);
        await assertNodes(page, ['scene:external', 'scene:retarget_scene_target', 'macro:retarget_macro', 'scene:retarget_macro_target']);
        await draft(page, root, { ...value, scenes: { external: '/scenes/not-on-disk.json' }, macros: {} });
        await showMap(page);
        await expect(page.getByText(/story issues/)).toBeVisible();
        await page.getByText(/story issues/).click();
        await expect(page.getByRole('region', { name: 'Story map', exact: true }).getByText(/not-on-disk/)).toBeVisible();
        expect(await options(page)).not.toContain('scene:retarget_scene_target');
        expect(await options(page)).not.toContain('scene:draft_external_target');
        expect(await diskTexts(page, root)).toEqual(disk);
    });

    test(`${name}: warns about malformed manifests and clears omitted draft membership`, async ({ page }) => {
        const { root, disk, manifest } = await fixture(page, name);
        for (const value of ['{ invalid', { ...manifest, scenes: 42 }]) {
            await draft(page, root, value);
            await showMap(page);
            await assertNodes(page, ['scene:loaded_start', 'scene:loaded_end', 'macro:loaded_macro']);
            const summary = page.getByRole('region', { name: 'Story map', exact: true }).locator('summary');
            await expect(summary).toHaveText(/story issues/);
            const details = summary.locator('..');
            if ((await details.getAttribute('open')) === null) await summary.click();
            await expect(details).toContainText('The unsaved manifest cannot be mapped yet. Showing the loaded project version.');
        }
        await draft(page, root, { ...manifest, scenes: undefined, macros: undefined, startScene: undefined });
        await showMap(page);
        await assertNodes(page, []);
        expect(await diskTexts(page, root)).toEqual(disk);
    });

    test(`${name}: opens a canonical source alias in the same dirty JSON tab`, async ({ page }) => {
        const { root, disk, manifest } = await fixture(page, name);
        const text = JSON.stringify({ commands: [jump('dirty_alias_target')] }, undefined, 4);
        const id = await page.evaluate(async ({ root, text }) => {
            const { useWorkbenchStore } = await import('/src/store/useWorkbenchStore.ts');
            const path = `${root}/scenes/map-new.json`;
            const id = `json:${path}`;
            useWorkbenchStore.getState().openOrFocusTab({ id, dirty: true, kind: 'json', path,
                preferredView: 'json', savedTextContent: '{"commands":[]}', textContent: text, title: 'Preserved draft' });
            return id;
        }, { root, text });
        await draft(page, root, { ...manifest, scenes: { external: '/scenes/./map-new.json' }, macros: {}, startScene: 'external' });
        await showMap(page);
        await assertNodes(page, ['scene:external', 'scene:dirty_alias_target']);
        await page.getByLabel('Go to story node').selectOption('scene:external');
        await page.getByRole('button', { name: 'Open command', exact: true }).click();
        await expect.poll(() => sourceState(page)).toEqual({ count: 1, dirty: true, id,
            path: `${root}/scenes/map-new.json`, selection: ['commands', 0], text });
        expect(await diskTexts(page, root)).toEqual(disk);
    });

    test(`${name}: retires overlapping descriptor loads and old project generations`, async ({ page }) => {
        const { root, disk, manifest } = await fixture(page, name);
        await delayRead(page, `${root}/scenes/map-new.json`);
        await draft(page, root, { ...manifest, startScene: 'pending', scenes: { pending: '/scenes/map-new.json' }, macros: {} });
        await showMap(page);
        await page.evaluate(() => globalThis.__storyMapDelay.started);
        await draft(page, root, { ...manifest, startScene: 'current', scenes: { current: [jump('current_target')] }, macros: {} });
        await showMap(page);
        await assertNodes(page, ['scene:current', 'scene:current_target']);
        await page.evaluate(async () => {
            globalThis.__storyMapDelay.release();
            await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        });
        await assertNodes(page, ['scene:current', 'scene:current_target']);
        await delayRead(page, `${root}/scenes/map-retarget.json`);
        const switching = await draft(page, root, { ...manifest, startScene: 'old_project_pending', scenes: { old_project_pending: '/scenes/map-retarget.json' }, macros: {} });
        await showMap(page);
        await page.evaluate(() => globalThis.__storyMapDelay.started);
        expect(await diskTexts(page, root)).toEqual(disk);
        const successor = await fixture(page, name);
        await assertNodes(page, ['scene:loaded_start', 'scene:loaded_end', 'macro:loaded_macro']);
        await page.evaluate(async () => {
            globalThis.__storyMapDelay.release();
            await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        });
        await assertNodes(page, ['scene:loaded_start', 'scene:loaded_end', 'macro:loaded_macro']);
        expect(await diskTexts(page, root)).toEqual({ ...disk, 'game.json': switching.text });
        expect(await diskTexts(page, successor.root)).toEqual(successor.disk);
    });
}
