import { expect } from '@playwright/test';

import { mountFixture, openFixture, readFixture, setup, test } from './authoringHelpers.mjs';

async function emptyDestination(page) {
    return mountFixture(page, {});
}

async function snapshot(page, root) {
    return page.evaluate(async root => {
        const { browserFsAdapter: fs } = await import('/src/services/fs/browserFsAdapter.ts');
        const files = {};
        async function visit(folder, prefix = '') {
            for (const entry of await fs.readDirectory(folder)) {
                const relative = `${prefix}${entry.name}`;
                if (entry.isDirectory) await visit(`${folder}/${entry.name}`, `${relative}/`);
                else {
                    const bytes = await fs.readBinaryFile(`${folder}/${entry.name}`);
                    let binary = '';
                    for (let offset = 0; offset < bytes.length; offset += 8192) binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
                    files[relative] = btoa(binary);
                }
            }
        }
        await visit(root);
        return files;
    }, root);
}

async function pickDestination(page, root) {
    await page.evaluate(async root => {
        const { browserFsAdapter: fs } = await import('/src/services/fs/browserFsAdapter.ts');
        const handle = await fs.getDirectoryHandle(root);
        globalThis.showDirectoryPicker = async () => handle;
    }, root);
}

async function createFromModal(page, root, template) {
    await page.evaluate(async () => {
        const { useEditorStore } = await import('/src/store/useEditorStore.ts');
        useEditorStore.getState().openNewProjectModal();
    });
    const dialog = page.getByRole('dialog', { name: 'New Project', exact: true });
    await dialog.getByLabel('Project Directory').fill(root);
    await dialog.getByLabel('Project Name').fill('Protected Project');
    await dialog.getByRole('radio', { name: template === 'blank' ? /^Blank/ : /^Classic VN/ }).click();
    await dialog.getByRole('button', { name: 'Create Project', exact: true }).click();
    return dialog;
}

async function currentProject(page) {
    return page.evaluate(async () => (await import('/src/store/storeBootstrap.ts')).useProjectStore.getState().projectPath);
}

for (const template of ['blank', 'classic-vn']) {
    test(`New Project ${template} creates complete exclusive output and rejects occupied retry`, async ({ page }) => {
        await setup(page);
        const root = await emptyDestination(page);
        const dialog = await createFromModal(page, root, template);
        await expect(dialog).toBeHidden({ timeout: 30_000 });
        expect(await currentProject(page)).toBe(root);
        const before = await snapshot(page, root);
        expect(before['.zerith-project-reservation']).toBeUndefined();
        const manifest = JSON.parse(Buffer.from(before['game.json'], 'base64').toString());
        expect(manifest.title).toBe('Protected Project');
        if (template === 'classic-vn') {
            const expected = await readFixture('classic-vn-starter');
            delete expected['game.json'];
            const actual = { ...before };
            delete actual['game.json'];
            expect(actual).toEqual(expected);
        } else expect(Object.keys(before).sort()).toEqual(['engine.config.json', 'game.json', 'scenes/intro.json']);
        const retry = await createFromModal(page, root, template);
        await page.getByRole('button', { name: 'Create and Open', exact: true }).click();
        await expect(retry.getByRole('status')).toContainText(/new or empty|outside the source/);
        expect(await snapshot(page, root)).toEqual(before);
        expect(await currentProject(page)).toBe(root);
    });
}

for (const fixture of ['classic-vn-starter', 'example-game']) {
    test(`Save As ${fixture} preserves every source byte and rejects occupied output through menu`, async ({ page }) => {
        await setup(page);
        const files = await readFixture(fixture);
        const source = await mountFixture(page, files);
        await openFixture(page, source);
        const target = await emptyDestination(page);
        await pickDestination(page, target);
        await page.getByText('File', { exact: true }).first().click();
        await page.getByRole('menuitem', { name: /Save Project As/ }).click();
        await expect.poll(() => currentProject(page), { timeout: 30_000 }).toBe(target);
        expect(await snapshot(page, target)).toEqual(files);
        expect(await snapshot(page, source)).toEqual(files);
        await pickDestination(page, source);
        await page.getByText('File', { exact: true }).first().click();
        await page.getByRole('menuitem', { name: /Save Project As/ }).click();
        await expect(page.getByRole('status').filter({ hasText: /new or empty/ }).first()).toBeVisible();
        expect(await snapshot(page, source)).toEqual(files);
        expect(await currentProject(page)).toBe(target);
    });
}

test('cancelled New Project confirmation leaves empty destination and unsaved source untouched', async ({ page }) => {
    await setup(page);
    const files = await readFixture('classic-vn-starter');
    const source = await mountFixture(page, files);
    await openFixture(page, source);
    const target = await emptyDestination(page);
    await page.evaluate(async source => {
        const { useProjectStore } = await import('/src/store/storeBootstrap.ts');
        const { useWorkbenchStore } = await import('/src/store/useWorkbenchStore.ts');
        const { browserFsAdapter: fs } = await import('/src/services/fs/browserFsAdapter.ts');
        const path = `${source}/game.json`;
        const savedText = await fs.readTextFile(path);
        const draft = JSON.stringify({ ...JSON.parse(savedText), title: 'Unsaved source draft' });
        useWorkbenchStore.getState().openOrFocusTab({ id: `manifest::${path}`, kind: 'manifest', path, textContent: savedText, title: 'game.json' });
        useWorkbenchStore.getState().updateTabContent(`manifest::${path}`, draft);
        useProjectStore.getState().markFileDirty(path);
    }, source);
    await createFromModal(page, target, 'blank');
    const confirm = page.getByRole('dialog').filter({ has: page.getByRole('button', { name: 'Create and Open' }) });
    await confirm.getByRole('button', { name: 'Cancel', exact: true }).click();
    expect(await snapshot(page, target)).toEqual({});
    expect(await snapshot(page, source)).toEqual(files);
    expect(await currentProject(page)).toBe(source);
    const draft = await page.evaluate(async source => {
        const { useProjectStore } = await import('/src/store/storeBootstrap.ts');
        const { useWorkbenchStore } = await import('/src/store/useWorkbenchStore.ts');
        return { dirty: useProjectStore.getState().dirtyFiles.has(`${source}/game.json`), text: useWorkbenchStore.getState().tabs.find(tab => tab.path === `${source}/game.json`)?.textContent };
    }, source);
    expect(draft.dirty).toBe(true);
    expect(draft.text).toContain('Unsaved source draft');
});

test('Save As cancellation, failed save, stale picker and partial write retain source ownership', async ({ page }) => {
    await setup(page);
    const files = await readFixture('classic-vn-starter');
    const source = await mountFixture(page, files);
    await openFixture(page, source);
    const target = await emptyDestination(page);
    const result = await page.evaluate(async ({ source, target }) => {
        const { browserFsAdapter: fs } = await import('/src/services/fs/browserFsAdapter.ts');
        const { useProjectStore } = await import('/src/store/storeBootstrap.ts');
        const { saveAndOpenProjectAs } = await import('/src/store/actions/projectDestinationActions.ts');
        const { executeOpenProjectInCurrentWindow } = await import('/src/store/actions/projectOpenActions.ts');
        const handle = await fs.getDirectoryHandle(target);
        const state = useProjectStore.getState();
        const originalSave = state.saveAllDirtyFiles;
        let saveCount = 0;
        useProjectStore.setState({ saveAllDirtyFiles: async () => { saveCount++; return { failed: ['intro.json'], saved: [], skipped: [] }; } });
        globalThis.showDirectoryPicker = async () => { throw new DOMException('Cancel', 'AbortError'); };
        const cancelled = await saveAndOpenProjectAs();
        const cancelledSaveCount = saveCount;
        globalThis.showDirectoryPicker = async () => handle;
        const failedSave = await saveAndOpenProjectAs().catch(error => error.message);
        useProjectStore.setState({ saveAllDirtyFiles: originalSave });
        let resolvePicker;
        globalThis.showDirectoryPicker = () => new Promise(resolve => { resolvePicker = resolve; });
        const pending = saveAndOpenProjectAs().catch(error => error.message);
        await executeOpenProjectInCurrentWindow(`${source}/game.json`, { checkMigration: false, prompt: false });
        resolvePicker(handle);
        const stale = await pending;
        globalThis.showDirectoryPicker = async () => handle;
        const originalWrite = fs.writeBinaryFileExclusive;
        let writes = 0;
        fs.writeBinaryFileExclusive = async (...args) => {
            if (++writes === 2) throw new Error('Injected disk failure');
            return originalWrite(...args);
        };
        const partial = await saveAndOpenProjectAs().catch(error => error.message);
        fs.writeBinaryFileExclusive = originalWrite;
        return { cancelled, cancelledSaveCount, failedSave, stale, partial, writes, current: useProjectStore.getState().projectPath };
    }, { source, target });
    expect(result.cancelled).toBeUndefined();
    expect(result.cancelledSaveCount).toBe(0);
    expect(result.failedSave).toContain('Source save did not complete');
    expect(result.stale).toContain('changed');
    expect(result.partial).toContain(`Partial project output remains at ${target}`);
    expect(result.writes).toBe(2);
    expect(result.current).toBe(source);
    expect(await snapshot(page, source)).toEqual(files);
    const partial = await snapshot(page, target);
    expect(Object.keys(partial)).toHaveLength(2);
    expect(partial['.zerith-project-reservation']).toBeDefined();
});

test('batched modal close and reopen invalidates deferred folder selection', async ({ page }) => {
    await setup(page);
    const target = await emptyDestination(page);
    await page.evaluate(async () => {
        const { useEditorStore } = await import('/src/store/useEditorStore.ts');
        globalThis.showDirectoryPicker = () => new Promise(resolve => { globalThis.resolveDestinationPicker = resolve; });
        useEditorStore.getState().openNewProjectModal();
    });
    await page.getByRole('button', { name: 'Browse...', exact: true }).click();
    await page.evaluate(async target => {
        const { useEditorStore } = await import('/src/store/useEditorStore.ts');
        const { browserFsAdapter: fs } = await import('/src/services/fs/browserFsAdapter.ts');
        const handle = await fs.getDirectoryHandle(target);
        useEditorStore.getState().closeNewProjectModal();
        useEditorStore.getState().openNewProjectModal();
        globalThis.resolveDestinationPicker(handle);
    }, target);
    const dialog = page.getByRole('dialog', { name: 'New Project', exact: true });
    await expect(dialog.getByLabel('Project Directory')).toHaveValue('');
    expect(await snapshot(page, target)).toEqual({});
});

for (const entry of ['palette', 'shortcut']) {
    test(`Save As ${entry} reports failed source save without destination writes`, async ({ page }) => {
        await setup(page);
        const files = await readFixture('classic-vn-starter');
        const source = await mountFixture(page, files);
        await openFixture(page, source);
        const target = await emptyDestination(page);
        await pickDestination(page, target);
        await page.evaluate(async () => {
            const { useProjectStore } = await import('/src/store/storeBootstrap.ts');
            useProjectStore.setState({ saveAllDirtyFiles: async () => ({ failed: ['intro.json'], saved: [], skipped: [] }) });
        });
        if (entry === 'palette') {
            await page.evaluate(async () => (await import('/src/store/useEditorStore.ts')).useEditorStore.getState().openCommandPalette());
            const palette = page.getByRole('dialog', { name: 'Command palette' });
            await palette.getByPlaceholder('Type an action (e.g. Save All, Play, Reset Layout)').fill('save project as');
            await palette.getByRole('option', { name: /Save Project As/ }).click();
        } else await page.keyboard.press('Control+Alt+Shift+s');
        await expect(page.getByRole('status').filter({ hasText: /Source save did not complete/ }).first()).toBeVisible();
        expect(await snapshot(page, target)).toEqual({});
        expect(await snapshot(page, source)).toEqual(files);
        expect(await currentProject(page)).toBe(source);
    });
}
