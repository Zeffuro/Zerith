import { expect } from '@playwright/test';

import { dock, mountFixture, openFixture, readFixture, replaceJson, setup, test } from './authoringHelpers.mjs';

const show = { action: 'show', id: 'aria', pose: 'normal', scaleX: 1, scaleY: 1, type: 'sprite', x: 400, y: 700 };
const line = { speaker: 'aria', text: 'The train is late.', type: 'dialogue' };
const move = { action: 'move', duration: 0, id: 'aria', type: 'sprite', x: 800 };

test.beforeEach(async ({ page }) => { await setup(page); });

async function startScene(page, commands, flipped = false) {
    const files = await readFixture('classic-vn-starter');
    replaceJson(files, 'scenes/intro.json', scene => ({ ...scene, commands }));
    if (flipped) replaceJson(files, 'data/characters.json', characters => ({ ...characters, aria: { ...characters.aria, displayDefaults: { ...characters.aria.displayDefaults, flip: true } } }));
    const root = await mountFixture(page, files);
    await openFixture(page, root);
    await page.evaluate(async root => {
        const { openProjectEntry } = await import('/src/services/openProjectEntry/index.ts');
        const { useEditorStore } = await import('/src/store/useEditorStore.ts');
        await openProjectEntry(`${root}/scenes/intro.json`, 'intro.json');
        useEditorStore.getState().triggerPlay();
    }, root);
    await dock(page, 'preview');
    await expect.poll(async () => (await state(page)).x).not.toBeUndefined();
}

async function state(page) {
    return page.evaluate(async () => {
        const { useScriptStore } = await import('/src/store/storeBootstrap.ts');
        const { useEngineBridgeStore } = await import('/src/store/useEngineBridgeStore.ts');
        const engine = useEngineBridgeStore.getState().engine;
        const sprite = engine?.display.getLayer('sprites').children.find(child => child.label === 'zerith-sprite:aria');
        return { busy: engine?.flow.isBusy, commands: useScriptStore.getState().rootScript, index: engine?.currentIndex, scaleX: sprite?.scale.x, x: sprite?.x, y: sprite?.y };
    });
}

async function enter(page) {
    const button = page.getByRole('button', { name: 'Place characters', exact: true });
    await expect(button).toBeEnabled();
    await button.click();
    await expect(page.getByRole('button', { name: 'Place aria', exact: true })).toBeVisible();
}

test('preserves inherited flip and stops synchronizing placement after Done', async ({ page }) => {
    await startScene(page, [show, line, move, { ...line, text: 'There it is.' }], true);
    await enter(page);
    await page.getByRole('button', { name: 'Place aria', exact: true }).focus();
    await page.keyboard.press('ArrowRight');
    await expect.poll(async () => (await state(page)).x).toBe(401);
    expect((await state(page)).scaleX).toBe(-1);
    await page.getByRole('button', { name: 'Options', exact: true }).click();
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    await page.evaluate(async () => { const { useEditorStore } = await import('/src/store/useEditorStore.ts'); useEditorStore.getState().triggerResume(); });
    await expect.poll(async () => (await state(page)).x).toBe(800);
    await page.evaluate(async () => { const { useScriptStore } = await import('/src/store/storeBootstrap.ts'); useScriptStore.getState().updateNodeAtPath([0], { x: 200 }); });
    await expect.poll(async () => (await state(page)).commands[0].x).toBe(200);
    expect((await state(page)).x).toBe(800);
});

test('rearranging same-character commands invalidates the old placement selection', async ({ page }) => {
    await startScene(page, [show, line, move, line]);
    await enter(page);
    await page.getByRole('button', { name: 'Place aria', exact: true }).click();
    await page.getByRole('button', { name: 'Options', exact: true }).click();
    await expect(page.getByLabel('Character X', { exact: true })).toBeEnabled();
    await page.evaluate(async () => { const { useScriptStore } = await import('/src/store/storeBootstrap.ts'); useScriptStore.getState().moveNodeByPath([2], [], 0); });
    await expect(page.getByLabel('Character X', { exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Place aria', exact: true })).toHaveAttribute('aria-pressed', 'false');
    expect((await state(page)).commands.filter(command => command.type === 'sprite').map(command => command.x)).toEqual([800, 400]);
    expect((await state(page)).x).toBe(400);
});

test('a branch position requires its command to be selected', async ({ page }) => {
    const choice = { options: [{ commands: [move, line], label: 'Wait on the platform' }], type: 'choice' };
    await startScene(page, [show, choice, { ...line, text: 'The station is quiet.' }]);
    await expect.poll(async () => (await state(page)).index).toBe(2);
    await page.evaluate(async () => { const { useEngineBridgeStore } = await import('/src/store/useEngineBridgeStore.ts'); useEngineBridgeStore.getState().engine.events.emit('input:choose', 0); });
    await expect.poll(async () => (await state(page)).x).toBe(800);
    await enter(page);
    const target = page.getByRole('button', { name: 'Place aria', exact: true });
    await target.focus();
    await page.keyboard.press('ArrowRight');
    expect((await state(page)).commands).toEqual([show, choice, { ...line, text: 'The station is quiet.' }]);
    expect((await state(page)).x).toBe(800);
    await page.evaluate(async () => { const { useScriptStore } = await import('/src/store/storeBootstrap.ts'); useScriptStore.getState().setSelectedNodePath([1, 'options', 0, 'commands', 0]); });
    await target.focus();
    await page.keyboard.press('ArrowRight');
    await expect.poll(async () => (await state(page)).commands[1].options[0].commands[0].x).toBe(801);
    expect((await state(page)).commands[0].x).toBe(400);
});

test('waits for a running transition before enabling placement', async ({ page }) => {
    await startScene(page, [show, { ...move, duration: 3 }, line]);
    await expect.poll(async () => (await state(page)).busy).toBe(true);
    await expect(page.getByRole('button', { name: 'Place characters', exact: true })).toBeDisabled();
    await enter(page);
    expect((await state(page)).x).toBe(800);
    await page.getByRole('button', { name: 'Place aria', exact: true }).focus();
    await page.keyboard.press('ArrowRight');
    await expect.poll(async () => (await state(page)).x).toBe(801);
    expect((await state(page)).commands[1].x).toBe(801);
});
