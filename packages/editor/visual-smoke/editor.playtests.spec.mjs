import { expect } from '@playwright/test';
import path from 'node:path';

import { dock, mountFixture, openFixture, previewState, readFixture, replaceJson, setup, test } from './authoringHelpers.mjs';

test.beforeEach(async ({ page }) => { await setup(page); });

test('saves a route, reopens it after reload and replays its choice with initial state', async ({ page }, info) => {
    const root = await mountFixture(page, await readFixture('classic-vn-starter'));
    await openFixture(page, root);
    await dock(page, 'playtests');
    await expect(page.getByRole('button', { name: 'Save playtest', exact: true })).toBeEnabled();
    await page.getByLabel('Playtest name').fill('Character route');
    await page.getByLabel('Starting scene', { exact: true }).selectOption('intro');
    await page.getByLabel('Starting command', { exact: true }).fill('9');
    await page.getByLabel('Playtest variables').fill('{"trust":2}');
    await page.getByLabel('chapter_notebook', { exact: true }).check();
    await page.getByText('Route recording and result checks', { exact: true }).click();
    await page.getByLabel('Recorded choices', { exact: true }).fill('[1]');
    await page.getByLabel('Expected scene', { exact: true }).selectOption('intro');
    await page.getByLabel('Expected variables', { exact: false }).fill('{"route_focus":"character","trust":2}');
    await page.getByRole('button', { name: 'Save playtest', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Character route', exact: true })).toBeVisible();
    expect(await page.evaluate(async root => {
        const { browserFsAdapter } = await import('/src/services/fs/browserFsAdapter.ts');
        return JSON.parse(await browserFsAdapter.readTextFile(`${root}/.zerith/playtests.json`)).scenarios[0].choices;
    }, root)).toEqual([1]);
    await page.reload();
    await page.evaluate(async root => {
        const { browserFsAdapter } = await import('/src/services/fs/browserFsAdapter.ts');
        await browserFsAdapter.recentProjects.ready();
        await browserFsAdapter.recentProjects.restore(`${root}/game.json`);
    }, root);
    await openFixture(page, root);
    await dock(page, 'playtests');
    await page.getByRole('button', { name: 'Character route', exact: true }).click();
    await page.getByText('Route recording and result checks', { exact: true }).click();
    await page.getByLabel('Replay recorded choices', { exact: true }).check();
    await page.locator('.flexlayout__tabset_tabbar_outer').filter({ hasText: 'Playtests' }).getByTitle('Maximize tab set').click();
    await page.getByLabel('Playtest name').scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(info.outputDir, 'playtest-library.png') });
    await page.getByRole('button', { name: 'Launch playtest', exact: true }).click();
    await expect.poll(async () => (await previewState(page)).state?.route_focus).toBe('character');
    const state = await previewState(page);
    expect(state.phase).toBe('playing');
    expect(state.choices).toEqual([1]);
    expect(state.inventory).toContain('chapter_notebook');
    expect(state.state.trust).toBe(2);
    await dock(page, 'playtests');
    await page.getByRole('button', { name: 'Check results', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Expected scene and variables match' })).toBeVisible();
    await page.getByRole('button', { name: 'Debug', exact: true }).click();
    await page.getByText('Pause', { exact: true }).click();
    await page.getByRole('button', { name: 'Debug', exact: true }).click();
    await page.getByText('Stop Playback', { exact: true }).click();
    expect((await previewState(page)).phase).toBe('idle');
});

test('restarts on a locale rebuild and keeps a replay mismatch visible', async ({ page }) => {
    const files = await readFixture('classic-vn-starter');
    files['locales/es.json'] = files['locales/en.json'];
    replaceJson(files, 'game.json', game => ({ ...game, localization: { ...game.localization, locales: { ...game.localization.locales, es: '/locales/es.json' } } }));
    const root = await mountFixture(page, files);
    await openFixture(page, root);
    await dock(page, 'playtests');
    await page.getByLabel('Playtest name').fill('Opening choice');
    await page.getByLabel('Starting scene', { exact: true }).selectOption('intro');
    await page.getByLabel('Starting command', { exact: true }).fill('9');
    await page.getByLabel('Playtest locale', { exact: true }).selectOption('es');
    await page.getByText('Route recording and result checks', { exact: true }).click();
    await page.getByLabel('Replay recorded choices', { exact: true }).check();
    await page.getByRole('button', { name: 'Launch playtest', exact: true }).click();
    await expect.poll(async () => (await previewState(page)).message).toContain('Recorded choices do not match');
    expect((await previewState(page)).scene).toBe('intro');
    await page.evaluate(async () => {
        const { useEngineBridgeStore } = await import('/src/store/useEngineBridgeStore.ts');
        useEngineBridgeStore.getState().engine.events.emit('input:choose', 0);
    });
    await expect.poll(async () => (await previewState(page)).state?.route_focus).toBe('outline');
});

test('a delayed save cannot replace the draft after switching away and back', async ({ page }) => {
    const files = await readFixture('classic-vn-starter');
    const first = await mountFixture(page, files);
    const second = await mountFixture(page, files);
    await openFixture(page, first);
    await dock(page, 'playtests');
    await page.getByLabel('Playtest name').fill('Opening notes');
    await page.evaluate(async () => {
        const { browserFsAdapter } = await import('/src/services/fs/browserFsAdapter.ts');
        const original = browserFsAdapter.writeTextFile.bind(browserFsAdapter);
        browserFsAdapter.writeTextFile = async (...args) => {
            if (args[0].endsWith('/.zerith/playtests.json')) await new Promise(resolve => { globalThis.releasePlaytestSave = resolve; });
            return original(...args);
        };
    });
    await page.getByRole('button', { name: 'Save playtest', exact: true }).click();
    await expect.poll(() => page.evaluate(() => typeof globalThis.releasePlaytestSave)).toBe('function');
    await openFixture(page, second);
    await openFixture(page, first);
    await dock(page, 'playtests');
    await page.evaluate(() => globalThis.releasePlaytestSave());
    await expect(page.getByRole('button', { name: 'Save playtest', exact: true })).toBeEnabled();
    await expect(page.getByLabel('Playtest name')).toHaveValue('');
});
