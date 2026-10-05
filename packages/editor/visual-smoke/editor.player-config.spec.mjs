import { expect } from '@playwright/test';

import { mountFixture, openFixture, readFixture, setup, test } from './authoringHelpers.mjs';

async function openConfig(page, root) {
    await page.evaluate(async root => {
        const { browserFsAdapter: fs } = await import('/src/services/fs/browserFsAdapter.ts');
        const { useWorkbenchStore, makeTabId } = await import('/src/store/useWorkbenchStore.ts');
        const path = `${root}/engine.config.json`;
        const content = await fs.readTextFile(path);
        useWorkbenchStore.getState().openOrFocusTab({ id: makeTabId('engineConfig', path), kind: 'engineConfig',
            path, title: 'Engine Config', textContent: content, savedTextContent: content, preferredView: 'timeline' });
        globalThis.dispatchEvent(new CustomEvent('zerith:dock-select', { detail: 'editor' }));
    }, root);
    await expect(page.getByRole('region', { name: 'Player menus' })).toBeVisible();
}

test('player menu defaults and customization save and reopen in the editor', async ({ page }, info) => {
    await setup(page);
    const root = await mountFixture(page, await readFixture('classic-vn-starter'));
    await openFixture(page, root);
    await openConfig(page, root);
    const menus = page.getByRole('region', { name: 'Player menus' });
    await expect(menus.getByRole('checkbox', { name: 'Enable player menus' })).toBeChecked();
    await menus.locator('input[placeholder="Game title"]').fill('Late Train');
    await menus.locator('input[placeholder="Optional subtitle"]').fill('A station after closing');
    await menus.locator('input[placeholder="6"]').fill('3');
    await menus.getByRole('button', { name: 'Reorder Settings in title menu' }).focus();
    await page.keyboard.press('ArrowUp');
    await menus.getByText('Layout and appearance', { exact: true }).click();
    await menus.getByRole('combobox', { name: 'Title layout' }).selectOption('center');
    await menus.getByRole('combobox', { name: 'Menu font' }).selectOption('serif');
    await menus.getByRole('spinbutton', { name: 'Button height (px)' }).fill('60');
    await menus.getByText('Custom action labels', { exact: true }).click();
    await menus.locator('input[placeholder="New Game"]').fill('Start');
    await menus.getByRole('checkbox', { name: 'Remember player settings for this game' }).uncheck();
    await page.getByRole('button', { name: 'Apply', exact: true }).click();
    await expect(page.getByText('Saved engine config.', { exact: true })).toBeVisible();
    await expect.poll(() => page.evaluate(async root => {
        const { browserFsAdapter: fs } = await import('/src/services/fs/browserFsAdapter.ts');
        return JSON.parse(await fs.readTextFile(`${root}/engine.config.json`)).player?.title;
    }, root)).toBe('Late Train');
    const saved = await page.evaluate(async root => {
        const { browserFsAdapter: fs } = await import('/src/services/fs/browserFsAdapter.ts');
        return JSON.parse(await fs.readTextFile(`${root}/engine.config.json`));
    }, root);
    expect(saved.player).toMatchObject({ titleAlignment: 'center', menuFont: 'serif', buttonHeight: 60, title: 'Late Train', subtitle: 'A station after closing', saveSlots: 3, rememberSettings: false, actionLabels: { 'new-game': 'Start' } });
    expect(saved.player.titleActions).toEqual(['new-game', 'continue', 'settings', 'load']);
    await menus.scrollIntoViewIfNeeded();
    await page.screenshot({ path: info.outputPath('player-authoring.png') });
    await page.evaluate(async () => { const { useWorkbenchStore } = await import('/src/store/useWorkbenchStore.ts'); useWorkbenchStore.getState().clearTabs(); });
    await openConfig(page, root);
    await expect(menus.locator('input[placeholder="Game title"]')).toHaveValue('Late Train');
    await expect(menus.locator('input[placeholder="6"]')).toHaveValue('3');
    await menus.getByRole('button', { name: 'Use player defaults' }).click();
    await page.getByRole('button', { name: 'Apply', exact: true }).click();
    await expect(page.getByText('Saved engine config.', { exact: true })).toBeVisible();
    await expect.poll(() => page.evaluate(async root => {
        const { browserFsAdapter: fs } = await import('/src/services/fs/browserFsAdapter.ts');
        return JSON.parse(await fs.readTextFile(`${root}/engine.config.json`)).player;
    }, root)).toBeUndefined();
});


async function dragMenuAction(page, menu, action, target, touch) {
    const source = page.locator(`[data-player-menu="${menu}"][data-player-action="${action}"] button`);
    const destination = page.locator(`[data-player-menu="${menu}"][data-player-action="${target}"]`);
    await destination.scrollIntoViewIfNeeded();
    await source.scrollIntoViewIfNeeded();
    if (!touch) {
        await source.dragTo(destination);
        return;
    }
    const start = await source.boundingBox();
    const end = await destination.boundingBox();
    expect(start).not.toBeNull();
    expect(end).not.toBeNull();
    const viewport = page.viewportSize();
    const from = { x: start.x + start.width / 2, y: start.y + start.height / 2 };
    const to = { x: end.x + end.width / 2, y: end.y + end.height / 2 };
    expect(from.y).toBeGreaterThan(0);
    expect(from.y).toBeLessThan(viewport.height);
    expect(to.y).toBeGreaterThan(0);
    expect(to.y).toBeLessThan(viewport.height);
    const session = await page.context().newCDPSession(page);
    try {
        await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...from, id: 1 }] });
        for (let step = 1; step <= 6; step++) {
            const point = { x: from.x + (to.x - from.x) * step / 6, y: from.y + (to.y - from.y) * step / 6, id: 1 };
            await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [point] });
        }
        await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    } finally {
        await session.detach();
    }
}

function enabledMenuOrder(page, menu) {
    return page.locator(`[data-player-menu="${menu}"]`).evaluateAll(rows => rows
        .filter(row => row.querySelector('input').checked)
        .map(row => row.dataset.playerAction));
}

test('player action handles drag and retain order after saving and reopening', async ({ page }, info) => {
    await setup(page);
    const root = await mountFixture(page, await readFixture('classic-vn-starter'));
    await openFixture(page, root);
    await openConfig(page, root);
    const touch = info.project.name === 'chromium-compact';
    const menus = page.getByRole('region', { name: 'Player menus' });
    await menus.locator('[data-player-menu="titleActions"]').getByRole('checkbox', { name: 'Continue', exact: true }).uncheck();
    await expect(menus.getByRole('button', { name: 'Reorder Continue in title menu' })).toBeDisabled();
    await dragMenuAction(page, 'titleActions', 'settings', 'new-game', touch);
    const titleOrder = ['settings', 'new-game', 'load'];
    await expect.poll(() => enabledMenuOrder(page, 'titleActions')).toEqual(titleOrder);
    await dragMenuAction(page, 'pauseActions', 'settings', 'save', touch);
    const pauseOrder = ['resume', 'settings', 'save', 'load', 'history', 'title'];
    await expect.poll(() => enabledMenuOrder(page, 'pauseActions')).toEqual(pauseOrder);
    await expect(menus.getByRole('checkbox', { name: 'New Game (required)', exact: true })).toBeChecked();
    await expect(menus.getByRole('checkbox', { name: 'Resume (required)', exact: true })).toBeChecked();
    await page.getByRole('button', { name: 'Apply', exact: true }).click();
    await expect(page.getByText('Saved engine config.', { exact: true })).toBeVisible();
    await expect.poll(() => page.evaluate(async root => {
        const { browserFsAdapter: fs } = await import('/src/services/fs/browserFsAdapter.ts');
        const player = JSON.parse(await fs.readTextFile(`${root}/engine.config.json`)).player;
        return { title: player?.titleActions, pause: player?.pauseActions };
    }, root)).toEqual({ title: titleOrder, pause: pauseOrder });
    await page.evaluate(async () => { const { useWorkbenchStore } = await import('/src/store/useWorkbenchStore.ts'); useWorkbenchStore.getState().clearTabs(); });
    await openConfig(page, root);
    await expect.poll(() => enabledMenuOrder(page, 'titleActions')).toEqual(titleOrder);
    await expect.poll(() => enabledMenuOrder(page, 'pauseActions')).toEqual(pauseOrder);
    await expect(menus.getByRole('button', { name: 'Reorder Continue in title menu' })).toBeDisabled();
});
