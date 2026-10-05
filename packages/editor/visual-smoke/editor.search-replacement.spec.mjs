import { expect } from '@playwright/test';

import { mountFixture, openFixture, readFixture, replaceJson, setup, test } from './authoringHelpers.mjs';

const token = 'SearchSafetyToken';
const paths = ['data/characters.json', 'data/items.json', 'data/macros.json', 'scenes/intro.json'];

async function openSearchFixture(page, fixture = 'classic-vn-starter') {
    await setup(page);
    const files = await readFixture(fixture);
    replaceJson(files, 'game.json', manifest => ({ ...manifest, characters: '/data/characters.json', items: '/data/items.json',
        macros: '/data/macros.json', scenes: { intro: '/scenes/intro.json' }, startScene: 'intro' }));
    const sources = {
        'data/characters.json': { guide: { displayName: token, name: 'guide' } },
        'data/items.json': { badge: { description: token, name: 'Badge' } },
        'data/macros.json': { $schema: 'zerith/macros', greet: [{ speaker: 'guide', text: token, type: 'dialogue' }] },
        'scenes/intro.json': { commands: [{ speaker: 'guide', text: token, type: 'dialogue' }], localeNamespace: 'search-safety', title: 'Preserved' },
    };
    for (const [relative, source] of Object.entries(sources)) files[relative] = Buffer.from(JSON.stringify(source, undefined, 4)).toString('base64');
    const root = await mountFixture(page, files);
    await openFixture(page, root);
    await page.evaluate(async root => {
        const { openProjectEntry } = await import('/src/services/openProjectEntry/index.ts');
        for (const relative of ['data/characters.json', 'data/items.json', 'data/macros.json', 'scenes/intro.json']) {
            await openProjectEntry(`${root}/${relative}`, relative.split('/').at(-1));
        }
        const { useEditorStore } = await import('/src/store/useEditorStore.ts');
        useEditorStore.getState().openGlobalSearchPopup('replace');
    }, root);
    await page.getByPlaceholder('Search scenes, macros, characters, items...').fill(token);
    await page.getByPlaceholder('Replace text...').fill('ReplacementKept');
    return { files, root };
}

async function confirmReplacement(page) {
    await page.getByRole('button', { name: 'Replace All', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Confirm Replace All' });
    await expect(dialog).toBeVisible();
    return dialog;
}

async function snapshot(page, root) {
    return page.evaluate(async ({ paths, root }) => {
        const { browserFsAdapter: fs } = await import('/src/services/fs/browserFsAdapter.ts');
        const { useProjectStore, useScriptStore } = await import('/src/store/storeBootstrap.ts');
        const { useWorkbenchStore } = await import('/src/store/useWorkbenchStore.ts');
        const disk = {};
        for (const relative of paths) disk[relative] = await fs.readTextFile(`${root}/${relative}`);
        const project = useProjectStore.getState();
        return { disk, dirty: [...project.dirtyFiles], items: project.items, script: useScriptStore.getState().rootScript,
            tabs: useWorkbenchStore.getState().tabs.map(({ dirty, path, savedTextContent, textContent }) => ({ dirty, path, savedTextContent, textContent })) };
    }, { paths, root });
}

for (const fixture of ['classic-vn-starter', 'example-game']) {
    test(`search replacement ${fixture} saves all four kinds and preserves metadata after reopen`, async ({ page }, info) => {
        const { root } = await openSearchFixture(page, fixture);
        await (await confirmReplacement(page)).getByRole('button', { name: 'Replace All', exact: true }).click();
        await expect(page.getByRole('status').filter({ hasText: 'Replaced content in 4 file(s).' })).toBeVisible();
        const state = await snapshot(page, root);
        for (const relative of paths) {
            expect(state.disk[relative]).toContain('ReplacementKept');
            expect(state.disk[relative]).not.toContain(token);
            expect(state.tabs.find(tab => tab.path === `${root}/${relative}`)).toMatchObject({ dirty: false, savedTextContent: state.disk[relative], textContent: state.disk[relative] });
        }
        expect(JSON.parse(state.disk['data/macros.json']).$schema).toBe('zerith/macros');
        expect(JSON.parse(state.disk['scenes/intro.json'])).toMatchObject({ localeNamespace: 'search-safety', title: 'Preserved' });
        expect(state.script[0].text).toBe('ReplacementKept');
        if (fixture === 'classic-vn-starter' && info.project.name === 'chromium-desktop') {
            await page.screenshot({ path: 'temp/search-replacement-20261004/search-success.png' });
        }
        await openFixture(page, root);
        expect((await snapshot(page, root)).disk).toEqual(state.disk);
    });
}

test('partial replacement preserves failed dirty draft and reports actual saved file count', async ({ page }) => {
    const { root } = await openSearchFixture(page);
    await page.evaluate(async root => {
        const { browserFsAdapter: fs } = await import('/src/services/fs/browserFsAdapter.ts');
        const { useWorkbenchStore } = await import('/src/store/useWorkbenchStore.ts');
        const write = fs.writeTextFile;
        fs.writeTextFile = async (path, content, options) => {
            if (path === `${root}/data/items.json`) {
                const tab = useWorkbenchStore.getState().tabs.find(tab => tab.path === path);
                useWorkbenchStore.getState().updateTabContent(tab.id, '{"badge":{"name":"Unsaved failed draft"}}');
                throw new Error('Injected permission failure');
            }
            return write(path, content, options);
        };
    }, root);
    const before = await snapshot(page, root);
    await (await confirmReplacement(page)).getByRole('button', { name: 'Replace All', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Injected permission failure' })).toContainText('Replaced content in 3 file(s).');
    const after = await snapshot(page, root);
    expect(after.disk['data/items.json']).toBe(before.disk['data/items.json']);
    expect(after.tabs.find(tab => tab.path.endsWith('/data/items.json'))).toMatchObject({ dirty: true,
        savedTextContent: before.disk['data/items.json'], textContent: '{"badge":{"name":"Unsaved failed draft"}}' });
    expect(after.items.badge.description).toBe(token);
    expect(after.dirty).toContain(`${root}/data/items.json`);
    for (const relative of paths.filter(path => path !== 'data/items.json')) expect(after.disk[relative]).toContain('ReplacementKept');
});

for (const singleMacro of [false, true]) {
    test(`search replacement refreshes ${singleMacro ? 'individual' : 'all'} active macros and stays clean`, async ({ page }) => {
        const { root } = await openSearchFixture(page);
        await page.evaluate(async ({ root, singleMacro }) => {
            const { openProjectEntry } = await import('/src/services/openProjectEntry/index.ts');
            const { useProjectStore } = await import('/src/store/storeBootstrap.ts');
            const path = `${root}/data/macros.json`;
            await openProjectEntry(path, 'macros.json');
            if (singleMacro) {
                const project = useProjectStore.getState();
                project.setActiveMacroName('greet');
                project.setEditingAllMacrosFile(false);
                project.setActiveFile(path, project.macros.greet);
            }
        }, { root, singleMacro });
        await (await confirmReplacement(page)).getByRole('button', { name: 'Replace All', exact: true }).click();
        await expect(page.getByRole('status').filter({ hasText: 'Replaced content in 4 file(s).' })).toBeVisible();
        const state = await snapshot(page, root);
        expect(state.tabs.find(tab => tab.path.endsWith('/data/macros.json'))).toMatchObject({ dirty: false,
            savedTextContent: state.disk['data/macros.json'], textContent: state.disk['data/macros.json'] });
        expect(state.dirty).toEqual([]);
        if (singleMacro) expect(state.script[0].text).toBe('ReplacementKept');
    });
}

test('dirty affected file blocks replacement and Cancel writes nothing', async ({ page }) => {
    const { root } = await openSearchFixture(page);
    const before = await snapshot(page, root);
    await (await confirmReplacement(page)).getByRole('button', { name: 'Cancel', exact: true }).click();
    expect((await snapshot(page, root)).disk).toEqual(before.disk);
    await page.evaluate(async root => {
        const { useWorkbenchStore } = await import('/src/store/useWorkbenchStore.ts');
        const tab = useWorkbenchStore.getState().tabs.find(tab => tab.path === `${root}/scenes/intro.json`);
        useWorkbenchStore.getState().updateTabContent(tab.id, 'unsaved source draft');
    }, root);
    await page.getByRole('button', { name: 'Replace All', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Save or discard unsaved changes' })).toBeVisible();
    expect((await snapshot(page, root)).disk).toEqual(before.disk);
    await expect(page.getByRole('dialog', { name: 'Confirm Replace All' })).toBeHidden();
});

test('external source change after confirmation fails only that output', async ({ page }) => {
    const { root } = await openSearchFixture(page);
    const dialog = await confirmReplacement(page);
    await page.evaluate(async root => {
        const { browserFsAdapter: fs } = await import('/src/services/fs/browserFsAdapter.ts');
        await fs.writeTextFile(`${root}/scenes/intro.json`, '[{"type":"dialogue","text":"External source"}]');
    }, root);
    await dialog.getByRole('button', { name: 'Replace All', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Replaced content in 3 file(s).' })).toContainText('Failed:');
    expect((await snapshot(page, root)).disk['scenes/intro.json']).toContain('External source');
});

test('same-path project reopen invalidates pending confirmation without writes or stale status', async ({ page }) => {
    const { root } = await openSearchFixture(page);
    const before = await snapshot(page, root);
    await confirmReplacement(page);
    await page.evaluate(async () => {
        const { useProjectStore } = await import('/src/store/storeBootstrap.ts');
        useProjectStore.getState().setProject(undefined, []);
    });
    await openFixture(page, root);
    await expect(page.getByRole('dialog', { name: 'Confirm Replace All' })).toBeHidden();
    expect((await snapshot(page, root)).disk).toEqual(before.disk);
    await expect(page.getByRole('status').filter({ hasText: 'Replaced content' })).toHaveCount(0);
});

test('query change and restore during write stops later files and preserves a newer successful-file draft', async ({ page }) => {
    const { root } = await openSearchFixture(page);
    await page.evaluate(async () => {
        const { browserFsAdapter: fs } = await import('/src/services/fs/browserFsAdapter.ts');
        const write = fs.writeTextFile;
        globalThis.firstReplacementStarted = false;
        globalThis.firstReplacementCompleted = false;
        fs.writeTextFile = async (path, content, options) => {
            globalThis.firstReplacementStarted = true;
            await new Promise(resolve => { globalThis.releaseReplacementWrite = resolve; });
            await write(path, content, options);
            globalThis.firstReplacementCompleted = true;
        };
    });
    const before = await snapshot(page, root);
    await (await confirmReplacement(page)).getByRole('button', { name: 'Replace All', exact: true }).click();
    await expect.poll(() => page.evaluate(() => globalThis.firstReplacementStarted)).toBe(true);
    await page.evaluate(async root => {
        const { useWorkbenchStore } = await import('/src/store/useWorkbenchStore.ts');
        const tab = useWorkbenchStore.getState().tabs.find(tab => tab.path === `${root}/data/characters.json`);
        useWorkbenchStore.getState().updateTabContent(tab.id, 'newer successful draft');
    }, root);
    const input = page.getByPlaceholder('Search scenes, macros, characters, items...');
    await input.fill('ChangedQuery');
    await input.fill(token);
    await page.evaluate(() => globalThis.releaseReplacementWrite());
    await expect.poll(() => page.evaluate(() => globalThis.firstReplacementCompleted)).toBe(true);
    const after = await snapshot(page, root);
    for (const relative of paths.slice(1)) expect(after.disk[relative]).toBe(before.disk[relative]);
    expect(after.tabs.find(tab => tab.path.endsWith('/data/characters.json'))).toMatchObject({ dirty: true,
        savedTextContent: after.disk['data/characters.json'], textContent: 'newer successful draft' });
    await expect(page.getByRole('status').filter({ hasText: 'Replaced content' })).toHaveCount(0);
});
