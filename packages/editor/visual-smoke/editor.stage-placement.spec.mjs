import { expect } from '@playwright/test';
import path from 'node:path';

import { dock, mountFixture, openFixture, readFixture, replaceJson, setup, test } from './authoringHelpers.mjs';

test.beforeEach(async ({ page }) => { await setup(page); });

async function placementFixture(page, maximizePreview = true) {
    const files = await readFixture('classic-vn-starter');
    replaceJson(files, 'scenes/intro.json', scene => ({ ...scene, commands: [
        { action: 'show', id: 'aria', pose: 'normal', scaleX: 1, scaleY: 1, type: 'sprite', x: 400, y: 700 },
        { action: 'show', id: 'cove', pose: 'normal', scaleX: 1, scaleY: 1, type: 'sprite', x: 900, y: 700 },
        scene.commands.find(command => command.type === 'dialogue'),
    ] }));
    replaceJson(files, 'scenes/chapter_one.json', scene => ({ ...scene, commands: [
        { action: 'show', id: 'aria', pose: 'normal', type: 'sprite', x: 200 }, scene.commands.find(command => command.type === 'dialogue'),
    ] }));
    const root = await mountFixture(page, files);
    await openFixture(page, root);
    await page.evaluate(async root => {
        const { openProjectEntry } = await import('/src/services/openProjectEntry/index.ts');
        const { useEditorStore } = await import('/src/store/useEditorStore.ts');
        await openProjectEntry(`${root}/scenes/intro.json`, 'intro.json');
        useEditorStore.getState().triggerPlay();
    }, root);
    await dock(page, 'preview');
    await expect.poll(() => page.evaluate(async () => {
        const { useEngineBridgeStore } = await import('/src/store/useEngineBridgeStore.ts');
        return useEngineBridgeStore.getState().engine?.display.getLayer('sprites').children.filter(child => child.label.startsWith('zerith-sprite:')).length;
    })).toBe(2);
    const maximize = page.locator('.flexlayout__tabset_tabbar_outer').filter({ hasText: 'Preview' }).getByTitle('Maximize tab set');
    if (maximizePreview && await maximize.count()) await maximize.click();
    await page.getByRole('button', { name: 'Place characters', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Place aria', exact: true })).toBeVisible();
    return root;
}

async function source(page) {
    return page.evaluate(async () => {
        const { useScriptStore } = await import('/src/store/storeBootstrap.ts');
        const { useEngineBridgeStore } = await import('/src/store/useEngineBridgeStore.ts');
        const sprite = useEngineBridgeStore.getState().engine.display.getLayer('sprites').children.find(child => child.label === 'zerith-sprite:aria');
        return { command: useScriptStore.getState().rootScript[0], live: { scale: sprite.scale.y, x: sprite.x, y: sprite.y, zIndex: sprite.zIndex } };
    });
}

test('places a real character, snaps once, supports undo and writes scale and layer', async ({ page }, info) => {
    const root = await placementFixture(page);
    const box = page.getByRole('button', { name: 'Place aria', exact: true });
    const bounds = await box.boundingBox();
    const start = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x + 31, start.y - 17);
    await page.mouse.up();
    await expect.poll(async () => (await source(page)).command.x).not.toBe(400);
    const placed = await source(page);
    expect(placed.command.x % 16).toBe(0);
    expect(placed.command.y % 16).toBe(0);
    expect(placed.live.x).toBe(placed.command.x);
    await page.evaluate(async () => { const { useScriptStore } = await import('/src/store/storeBootstrap.ts'); useScriptStore.getState().undo(); });
    await expect.poll(async () => (await source(page)).live.x).toBe(400);
    await page.evaluate(async () => { const { useScriptStore } = await import('/src/store/storeBootstrap.ts'); useScriptStore.getState().redo(); });
    await expect.poll(async () => (await source(page)).live.x).toBe(placed.command.x);
    await page.getByRole('button', { name: 'Options', exact: true }).click();
    await page.getByLabel('Character scale', { exact: true }).fill('125');
    await page.getByRole('button', { name: 'Bring forward', exact: true }).click();
    await expect.poll(async () => (await source(page)).command.scaleY).toBe(1.25);
    await expect.poll(async () => (await source(page)).live.zIndex).toBeGreaterThan(0);
    await page.screenshot({ path: path.join(info.outputDir, 'character-placement.png') });
    const saved = await page.evaluate(async root => {
        const { useProjectStore } = await import('/src/store/storeBootstrap.ts');
        const { browserFsAdapter } = await import('/src/services/fs/browserFsAdapter.ts');
        const report = await useProjectStore.getState().saveAllDirtyFiles();
        return { command: JSON.parse(await browserFsAdapter.readTextFile(`${root}/scenes/intro.json`)).commands[0], failed: report.failed, skipped: report.skipped };
    }, root);
    expect(saved.failed).toEqual([]);
    expect(saved.skipped).toEqual([]);
    expect(saved.command.scaleY).toBe(1.25);
    expect(saved.command.x).toBe(placed.command.x);
    await openFixture(page, root);
    await page.evaluate(async root => {
        const { openProjectEntry } = await import('/src/services/openProjectEntry/index.ts');
        const { useEditorStore } = await import('/src/store/useEditorStore.ts');
        await openProjectEntry(`${root}/scenes/intro.json`, 'intro.json');
        useEditorStore.getState().triggerPlay();
    }, root);
    await expect.poll(async () => (await source(page)).live.scale).toBe(1.25);
    expect((await source(page)).live.x).toBe(placed.command.x);
});

test('Escape restores a drag and another scene cannot take ownership of old sprites', async ({ page }) => {
    const root = await placementFixture(page);
    const box = page.getByRole('button', { name: 'Place aria', exact: true });
    const bounds = await box.boundingBox();
    await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
    await page.mouse.down();
    await page.mouse.move(bounds.x + bounds.width / 2 + 32, bounds.y + bounds.height / 2);
    await page.keyboard.press('Escape');
    await page.mouse.up();
    expect((await source(page)).command.x).toBe(400);
    expect((await source(page)).live.x).toBe(400);
    await page.evaluate(async root => {
        const { openProjectEntry } = await import('/src/services/openProjectEntry/index.ts');
        await openProjectEntry(`${root}/scenes/chapter_one.json`, 'chapter_one.json');
    }, root);
    await dock(page, 'preview');
    await expect(page.getByRole('button', { name: 'Place characters', exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Place aria', exact: true })).toHaveCount(0);
    expect((await source(page)).command.x).toBe(200);
    expect((await source(page)).live.x).toBe(400);
});

test('a new command selection for the same character writes to that command', async ({ page }) => {
    await placementFixture(page);
    const box = page.getByRole('button', { name: 'Place aria', exact: true });
    await box.click();
    await page.evaluate(async () => {
        const { useScriptStore } = await import('/src/store/storeBootstrap.ts');
        const store = useScriptStore.getState();
        store.setScript([...store.rootScript, { action: 'move', duration: 0, id: 'aria', type: 'sprite', x: 300 }]);
        useScriptStore.getState().setSelectedNodePath([3]);
    });
    await box.focus();
    await page.keyboard.press('ArrowRight');
    const commands = await page.evaluate(async () => { const { useScriptStore } = await import('/src/store/storeBootstrap.ts'); return useScriptStore.getState().rootScript; });
    expect(commands[0].x).toBe(400);
    expect(commands[3].x).toBe(401);
});

test('places a character shown by a macro without editing the shared macro', async ({ page }, info) => {
    const root = await mountFixture(page, await readFixture('classic-vn-starter'));
    await openFixture(page, root);
    await page.evaluate(async root => {
        const { openProjectEntry } = await import('/src/services/openProjectEntry/index.ts');
        const { useEditorStore } = await import('/src/store/useEditorStore.ts');
        await openProjectEntry(`${root}/scenes/intro.json`, 'intro.json');
        useEditorStore.getState().triggerPlay();
    }, root);
    await dock(page, 'preview');
    await expect.poll(() => page.evaluate(async () => {
        const { useEngineBridgeStore } = await import('/src/store/useEngineBridgeStore.ts');
        return useEngineBridgeStore.getState().engine?.display.getLayer('sprites').children.filter(child => child.label.startsWith('zerith-sprite:')).length;
    })).toBe(2);
    await page.getByRole('button', { name: 'Place characters', exact: true }).click();
    const box = page.getByRole('button', { name: 'Place aria', exact: true });
    await box.focus();
    await page.keyboard.press('ArrowRight');
    await expect.poll(() => page.evaluate(async () => {
        const { useScriptStore } = await import('/src/store/storeBootstrap.ts');
        return useScriptStore.getState().rootScript.some(command => command.type === 'sprite' && command.id === 'aria' && command.action === 'move');
    })).toBe(true);
    const before = await page.evaluate(async root => {
        const { useProjectStore, useScriptStore } = await import('/src/store/storeBootstrap.ts');
        const { useEngineBridgeStore } = await import('/src/store/useEngineBridgeStore.ts');
        const { browserFsAdapter } = await import('/src/services/fs/browserFsAdapter.ts');
        return { dirty: [...useProjectStore.getState().dirtyFiles], macros: await browserFsAdapter.readTextFile(`${root}/data/macros.json`),
            past: useScriptStore.getState().past.length, index: useEngineBridgeStore.getState().engine.currentIndex,
            x: useEngineBridgeStore.getState().engine.display.getLayer('sprites').children.find(sprite => sprite.label === 'zerith-sprite:aria').x };
    }, root);
    expect(before.dirty).toContain(`${root}/scenes/intro.json`);
    expect(before.dirty).not.toContain(`${root}/data/macros.json`);
    await page.evaluate(async () => { const { useScriptStore } = await import('/src/store/storeBootstrap.ts'); useScriptStore.getState().undo(); });
    await expect.poll(async () => page.evaluate(async () => {
        const { useScriptStore } = await import('/src/store/storeBootstrap.ts');
        return useScriptStore.getState().rootScript.some(command => command.type === 'sprite');
    })).toBe(false);
    await page.evaluate(async () => { const { useScriptStore } = await import('/src/store/storeBootstrap.ts'); useScriptStore.getState().redo(); });
    await expect.poll(() => page.evaluate(async () => {
        const { useEngineBridgeStore } = await import('/src/store/useEngineBridgeStore.ts');
        return useEngineBridgeStore.getState().engine.display.getLayer('sprites').children.find(sprite => sprite.label === 'zerith-sprite:aria').x;
    })).toBe(before.x);
    expect(await page.evaluate(async root => {
        const { browserFsAdapter } = await import('/src/services/fs/browserFsAdapter.ts');
        return browserFsAdapter.readTextFile(`${root}/data/macros.json`);
    }, root)).toBe(before.macros);
    await page.getByRole('button', { name: 'Options', exact: true }).click();
    await page.getByLabel('Character scale', { exact: true }).fill('120');
    await page.getByLabel('Character X', { exact: true }).fill('600');
    await page.getByRole('button', { name: 'Center', exact: true }).focus();
    await expect.poll(() => page.evaluate(async () => {
        const { useScriptStore } = await import('/src/store/storeBootstrap.ts');
        const { useEngineBridgeStore } = await import('/src/store/useEngineBridgeStore.ts');
        return { command: useScriptStore.getState().rootScript.find(command => command.type === 'sprite' && command.id === 'aria'), x: useEngineBridgeStore.getState().engine.display.getLayer('sprites').children.find(sprite => sprite.label === 'zerith-sprite:aria').x };
    })).toMatchObject({ command: { scaleY: 1.2, x: 600 }, x: 600 });
    await page.getByRole('button', { name: 'Close placement options', exact: true }).click();
    await page.screenshot({ path: info.outputPath('macro-placement.png') });
});

test('placement options keep the full docked preview canvas', async ({ page }, info) => {
    await placementFixture(page, false);
    const canvas = page.getByRole('application', { name: 'Game preview playback', exact: true }).locator('canvas');
    const initial = await canvas.boundingBox();
    const header = page.locator('.flexlayout__tabset_tabbar_outer').filter({ hasText: 'Preview' });
    await expect(header.getByRole('button', { name: 'Options', exact: true })).toBeVisible();
    const placementButton = await header.getByRole('button', { name: 'Options', exact: true }).boundingBox();
    expect(placementButton.width).toBe(20);
    expect(placementButton.height).toBe(20);
    await expect(page.getByRole('dialog', { name: 'Placement options' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Options', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Placement options' })).toBeVisible();
    expect(await canvas.boundingBox()).toEqual(initial);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Options', exact: true })).toBeFocused();
    await expect(page.getByRole('dialog', { name: 'Placement options' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Options', exact: true }).click();
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    expect(await canvas.boundingBox()).toEqual(initial);
    await page.getByRole('button', { name: 'Place characters', exact: true }).click();
    await page.getByRole('button', { name: 'Options', exact: true }).click();
    await page.getByLabel('Placement character', { exact: true }).selectOption('aria');
    await page.getByLabel('Character X', { exact: true }).fill('500');
    await page.getByRole('button', { name: 'File', exact: true }).click();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'Placement options' })).toHaveCount(0);
    await expect.poll(async () => (await source(page)).live.x).toBe(500);
    expect(await canvas.boundingBox()).toEqual(initial);
    await page.screenshot({ path: info.outputPath('docked-placement.png') });
});
