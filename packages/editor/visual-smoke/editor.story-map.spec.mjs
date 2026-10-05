import { expect } from '@playwright/test';
import path from 'node:path';

import { dock, mountFixture, openFixture, readFixture, replaceJson, setup, test } from './authoringHelpers.mjs';

test.beforeEach(async ({ page }) => { await setup(page); });

async function openMap(page, root) {
    await openFixture(page, root);
    await dock(page, 'story_map');
    await expect(page.getByRole('region', { name: 'Story map', exact: true })).toBeVisible();
    await page.locator('.flexlayout__tabset_tabbar_outer').filter({ hasText: 'Story Map' }).getByTitle('Maximize tab set').click();
}

async function mapFixture() {
    const files = await readFixture('classic-vn-starter');
    replaceJson(files, 'scenes/intro.json', scene => ({ ...scene, commands: [{ type: 'label', name: 'intro.start' }, { type: 'choice', id: 'Choose a chapter', options: [
        { label: 'Read chapter one', commands: [{ type: 'jump', to: 'chapter_one' }] },
        { label: 'Skip to ending', commands: [{ type: 'jump', to: 'ending' }] },
    ] }, { type: 'jump', to: 'missing_chapter' }] }));
    replaceJson(files, 'game.json', game => ({ ...game, scenes: { ...game.scenes, unused_chapter: '/scenes/unused_chapter.json' } }));
    files['scenes/unused_chapter.json'] = Buffer.from(JSON.stringify({ $schema: 'zerith/scene', commands: [{ type: 'label', name: 'optional_chapter' }] })).toString('base64');
    return files;
}

test('opens the choice command and filters missing and unreachable chapters', async ({ page }, info) => {
    const root = await mountFixture(page, await mapFixture());
    await openMap(page, root);
    await page.getByLabel('Go to story node').selectOption({ label: 'choice: Choose a chapter' });
    await page.getByRole('button', { name: 'choice Choose a chapter', exact: true }).focus();
    await page.keyboard.press('Enter');
    await expect.poll(() => page.evaluate(async () => {
        const { useProjectStore, useScriptStore } = await import('/src/store/storeBootstrap.ts');
        return { path: useProjectStore.getState().activeFile, selected: useScriptStore.getState().selectedNodePath };
    })).toEqual({ path: `${root}/scenes/intro.json`, selected: [1] });
    await dock(page, 'story_map');
    await page.getByLabel('Go to story node').selectOption({ label: 'choice: Choose a chapter' });
    await page.getByRole('button', { name: 'choice Choose a chapter', exact: true }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('[data-node-id="scene:chapter_one"]')).toBeFocused();
    const branch = page.getByRole('region', { name: 'Story map', exact: true }).locator('div').filter({ has: page.getByText('Choose a chapter → chapter_one: Read chapter one', { exact: true }) }).last();
    await branch.getByRole('button', { name: 'Open command', exact: true }).click();
    await expect.poll(() => page.evaluate(async () => {
        const { useScriptStore } = await import('/src/store/storeBootstrap.ts');
        return useScriptStore.getState().selectedNodePath;
    })).toEqual([1, 'options', 0, 'commands', 0]);
    await dock(page, 'story_map');
    await page.getByLabel('Story map filter').selectOption('missing');
    await page.getByLabel('Go to story node').selectOption({ label: 'missing: missing_chapter' });
    await expect(page.getByRole('button', { name: 'missing missing_chapter, missing', exact: true })).toBeVisible();
    await expect(page.getByLabel('Go to story node').locator('option')).toHaveCount(3);
    await page.getByLabel('Story map filter').selectOption('unreachable');
    await page.getByLabel('Go to story node').selectOption({ label: 'scene: unused_chapter' });
    await expect(page.getByRole('button', { name: 'scene unused_chapter, unreachable', exact: true })).toBeVisible();
    await page.getByLabel('Story map filter').selectOption('all');
    await page.getByRole('button', { name: 'Reset view', exact: true }).click();
    await page.locator('.flexlayout__tabset_tabbar_outer').filter({ hasText: 'Story Map' }).getByTitle('Maximize tab set').click();
    await page.screenshot({ path: path.join(info.outputDir, 'story-map.png') });
});

test('remembers pan, zoom and node layout after reopening without changing project files', async ({ page }) => {
    const root = await mountFixture(page, await mapFixture());
    await openMap(page, root);
    const diskBefore = await page.evaluate(async root => { const { browserFsAdapter } = await import('/src/services/fs/browserFsAdapter.ts'); return browserFsAdapter.readTextFile(`${root}/scenes/intro.json`); }, root);
    await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
    const node = page.locator('[data-node-id="scene:intro"]');
    const rect = await node.boundingBox();
    await page.mouse.move(rect.x + 40, rect.y + 35);
    await page.mouse.down();
    await page.mouse.move(rect.x + 80, rect.y + 65, { steps: 4 });
    await page.mouse.up();
    const canvas = page.getByLabel('Story map canvas');
    const box = await canvas.boundingBox();
    await page.mouse.move(box.x + box.width - 12, box.y + box.height - 12);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width - 70, box.y + box.height - 60, { steps: 4 });
    await page.mouse.up();
    const view = await page.evaluate(() => localStorage.getItem('zerith-story-map-view-v1'));
    const prefs = Object.values(JSON.parse(view))[0];
    expect(prefs.zoom).toBe(1.1);
    expect(prefs.positions['scene:intro'].x).toBeGreaterThan(32);
    expect(prefs.pan.x).toBeLessThan(0);
    await page.reload();
    await page.evaluate(async root => { const { browserFsAdapter } = await import('/src/services/fs/browserFsAdapter.ts'); await browserFsAdapter.recentProjects.ready(); await browserFsAdapter.recentProjects.restore(`${root}/game.json`); }, root);
    await openFixture(page, root);
    await dock(page, 'story_map');
    await expect(page.getByLabel('Story map zoom')).toHaveText('110%');
    expect(await page.evaluate(() => localStorage.getItem('zerith-story-map-view-v1'))).toBe(view);
    expect(await page.evaluate(async root => { const { browserFsAdapter } = await import('/src/services/fs/browserFsAdapter.ts'); return browserFsAdapter.readTextFile(`${root}/scenes/intro.json`); }, root)).toBe(diskBefore);
});

test('shows playtest scene transitions only for the matching project', async ({ page }, info) => {
    const root = await mountFixture(page, await readFixture('example-game'));
    await openMap(page, root);
    const names = await page.evaluate(async () => { const { useProjectStore } = await import('/src/store/storeBootstrap.ts'); return Object.keys(useProjectStore.getState().scenes); });
    expect(names.length).toBeGreaterThan(0);
    const transition = await page.evaluate(async () => {
        const { useProjectStore } = await import('/src/store/storeBootstrap.ts');
        const { storyMapFromProject } = await import('/src/services/storyMap/storyMapProject.ts');
        const map = storyMapFromProject(useProjectStore.getState(), []);
        const edge = map.edges.find(edge => edge.type === 'jump' && map.nodes.find(node => node.id === edge.to)?.kind === 'scene');
        const from = map.nodes.find(node => node.id === edge.from);
        return { from: from.owner?.replace('scene:', '') ?? from.label, to: edge.to.replace('scene:', '') };
    });
    await page.evaluate(async ({ root, transition }) => {
        const { usePlaytestStore } = await import('/src/store/usePlaytestStore.ts');
        const { useProjectStore } = await import('/src/store/storeBootstrap.ts');
        usePlaytestStore.setState({ request: { generation: useProjectStore.getState().projectGeneration, id: 1000, projectPath: root, replay: false, scenario: { scene: transition.from } }, phase: 'idle', visited: ['preview', transition.to] });
    }, { root, transition });
    await page.getByLabel('Go to story node').selectOption(`scene:${transition.from}`);
    await expect(page.getByRole('button', { name: `scene ${transition.from}, visited`, exact: true })).toBeVisible();
    await expect(page.locator('[data-visited-route="true"]')).not.toHaveCount(0);
    await page.screenshot({ path: path.join(info.outputDir, 'story-map-visited.png') });
    await page.evaluate(async () => { const { usePlaytestStore } = await import('/src/store/usePlaytestStore.ts'); usePlaytestStore.setState({ request: { ...usePlaytestStore.getState().request, projectPath: '/another-project' } }); });
    await expect(page.locator('[data-visited-route="true"]')).toHaveCount(0);
    await expect(page.getByRole('button', { name: `scene ${transition.from}`, exact: true })).toBeVisible();
});

test('keeps a large story navigable while rendering only nearby nodes', async ({ page }) => {
    const files = await readFixture('classic-vn-starter');
    replaceJson(files, 'game.json', game => ({ ...game, macros: undefined, scenes: Object.fromEntries(Array.from({ length: 1500 }, (_, index) => [`chapter_${index}`, [{ type: 'jump', to: `chapter_${(index + 1) % 1500}` }]])), startScene: 'chapter_0' }));
    const root = await mountFixture(page, files);
    await openMap(page, root);
    await expect(page.getByText(/1500 of 1500 nodes/)).toBeVisible();
    expect(await page.locator('[data-node-id]').count()).toBeLessThan(100);
    await page.getByLabel('Go to story node').selectOption('scene:chapter_1499');
    await expect(page.getByRole('button', { name: 'scene chapter_1499', exact: true })).toBeVisible();
    await page.getByLabel('Find story node').fill('chapter_1499');
    await expect(page.getByText(/1 of 1500 nodes/)).toBeVisible();
    await page.getByRole('button', { name: 'Open source', exact: true }).click();
    await expect.poll(() => page.evaluate(async () => {
        const { useWorkbenchStore } = await import('/src/store/useWorkbenchStore.ts');
        const state = useWorkbenchStore.getState();
        const tab = state.tabs.find(tab => tab.id === state.activeTabId);
        return { path: tab?.path, selection: tab?.jsonSelectionPath };
    })).toEqual({ path: `${root}/game.json`, selection: ['scenes', 'chapter_1499'] });
});
