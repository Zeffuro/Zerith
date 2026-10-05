import { expect, test } from '@playwright/test';

const shell = page => page.locator('.zerith-player-shell');
const line = text => ({ type: 'dialogue', speaker: 'Narrator', text, instant: true });
const increment = { type: 'set', key: 'effects', op: 'add', value: 1 };
const storageKey = slot => `zerith:web:continuation-check:zerith_save_${slot}`;
const settlePresentation = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));

async function setup(page, commands, macros = {}) {
    await page.route('**/engine.config.json', async route => {
        const config = await (await route.fetch()).json();
        config.accessibility = { ...config.accessibility, captions: true, reducedMotion: true, typewriterSpeedMultiplier: 0 };
        config.player = {};
        await route.fulfill({ json: config });
    });
    await page.route('**/game.json', route => route.fulfill({ json: { schemaVersion: 2, id: 'continuation-check', title: 'Save continuation check',
        startScene: 'intro', scenes: { intro: '/continuation-scene.json' }, macros: '/continuation-macros.json' } }));
    await page.route('**/continuation-scene.json', route => route.fulfill({ json: { schemaVersion: 2, commands } }));
    await page.route('**/continuation-macros.json', route => route.fulfill({ json: macros }));
    await page.goto('http://127.0.0.1:1423/');
    await shell(page).getByRole('button', { name: 'New Game', exact: true }).click();
    await expect(shell(page)).toBeHidden();
}

async function expectLine(page, text) {
    await expect(page.locator('[role="status"]').filter({ hasText: text })).toHaveCount(1);
}

async function save(page, slot) {
    await settlePresentation(page);
    await page.keyboard.press('s');
    await shell(page).getByRole('button', { name: `Slot ${slot}`, exact: false }).click();
    await expect(shell(page).getByRole('status')).toHaveText(`Saved to slot ${slot}.`);
    const data = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), storageKey(slot));
    await shell(page).getByRole('button', { name: 'Back', exact: true }).click();
    await shell(page).getByRole('button', { name: 'Resume', exact: true }).click();
    return data;
}

async function load(page, slot) {
    await page.keyboard.press('l');
    await shell(page).getByRole('button', { name: `Slot ${slot}`, exact: false }).click();
    await shell(page).getByRole('button', { name: 'Confirm', exact: true }).click();
    await expect(shell(page)).toBeHidden();
    await settlePresentation(page);
}

test('macro save resumes the same line and tail without repeating effects or history', async ({ page }, testInfo) => {
    await setup(page, [{ type: 'call', name: 'outer' }, line('Root after macro')], {
        outer: [{ type: 'call', name: 'inner' }, line('Outer tail')],
        inner: [increment, line('Inner first'), increment, line('Inner second')],
    });
    await expectLine(page, 'Inner first');
    const first = await save(page, 1);
    expect(first.saveSchemaVersion).toBe(2);
    expect(first.continuation.replay.command.text).toBe('Inner first');
    expect(first.continuation.injectedCommands).toHaveLength(3);
    expect(first.state.effects).toBe(1);
    await page.keyboard.press('Space');
    await expectLine(page, 'Inner second');
    await load(page, 1);
    await expectLine(page, 'Inner first');
    await page.screenshot({ path: testInfo.outputPath('macro-restored.png') });
    const restored = await save(page, 2);
    expect(restored.state.effects).toBe(1);
    expect(restored.system.history.map(entry => entry.text)).toEqual(['Inner first']);
    await page.keyboard.press('Space');
    await expectLine(page, 'Inner second');
    expect((await save(page, 3)).state.effects).toBe(2);
    await page.keyboard.press('Space');
    await expectLine(page, 'Outer tail');
    await page.keyboard.press('Space');
    await expectLine(page, 'Root after macro');
});

test('a waiting choice and its selected branch both roundtrip through the load menu', async ({ page }) => {
    await setup(page, [line('Before choice'), { type: 'choice', options: [{ label: 'Take the branch',
        commands: [increment, line('Branch first'), line('Branch second')] }] }, line('Root after choice')]);
    await expectLine(page, 'Before choice');
    await page.keyboard.press('Space');
    const choice = await save(page, 1);
    expect(choice.continuation.replay.kind).toBe('choice');
    await page.keyboard.press('Enter');
    await expectLine(page, 'Branch first');
    await load(page, 1);
    await page.keyboard.press('Enter');
    await settlePresentation(page);
    await expectLine(page, 'Branch first');
    expect((await save(page, 2)).state.effects).toBe(1);
    await page.keyboard.press('Space');
    await expectLine(page, 'Branch second');
    await load(page, 2);
    await expectLine(page, 'Branch first');
    expect((await save(page, 3)).state.effects).toBe(1);
    await page.keyboard.press('Space');
    await expectLine(page, 'Branch second');
    await page.keyboard.press('Space');
    await expectLine(page, 'Root after choice');
});

test('loop save retains remaining iterations and rejects changed content without ending current play', async ({ page }) => {
    const commands = [{ type: 'for', from: 1, to: 2, iterator: 'iteration', body: [increment, line('Inside loop')] }, line('Loop finished')];
    await setup(page, commands);
    await expectLine(page, 'Inside loop');
    await save(page, 1);
    await page.keyboard.press('Space');
    expect((await save(page, 2)).state.effects).toBe(2);
    await load(page, 1);
    await expectLine(page, 'Inside loop');
    expect((await save(page, 3)).state.effects).toBe(1);
    await page.keyboard.press('Space');
    await expectLine(page, 'Inside loop');
    expect((await save(page, 4)).state.effects).toBe(2);
    await page.keyboard.press('Space');
    await expectLine(page, 'Loop finished');
    await page.evaluate(key => {
        const data = JSON.parse(localStorage.getItem(key));
        data.continuation.sourceFingerprint = 'changed-content';
        localStorage.setItem(key, JSON.stringify(data));
    }, storageKey(1));
    await page.keyboard.press('l');
    await shell(page).getByRole('button', { name: 'Slot 1', exact: false }).click();
    await shell(page).getByRole('button', { name: 'Confirm', exact: true }).click();
    await expect(shell(page).getByRole('status')).toContainText('content changed');
    await shell(page).getByRole('button', { name: 'Cancel', exact: true }).click();
    await shell(page).getByRole('button', { name: 'Back', exact: true }).click();
    await shell(page).getByRole('button', { name: 'Resume', exact: true }).click();
    await expectLine(page, 'Loop finished');
});

test('a missing saved background rejects the load and preserves current nested play', async ({ page }) => {
    await setup(page, [{ type: 'call', name: 'nested' }, line('After nested')], {
        nested: [increment, line('Current safe line'), line('Still pending')],
    });
    await expectLine(page, 'Current safe line');
    await save(page, 1);
    await page.route('**/missing-save-background.png', route => route.fulfill({ status: 404, body: 'missing' }));
    await page.evaluate(key => {
        const data = JSON.parse(localStorage.getItem(key));
        data.system.background = '/missing-save-background.png';
        localStorage.setItem(key, JSON.stringify(data));
    }, storageKey(1));
    await page.keyboard.press('l');
    await shell(page).getByRole('button', { name: 'Slot 1', exact: false }).click();
    await shell(page).getByRole('button', { name: 'Confirm', exact: true }).click();
    await expect(shell(page).getByRole('status')).toContainText('missing-save-background.png');
    await shell(page).getByRole('button', { name: 'Cancel', exact: true }).click();
    await shell(page).getByRole('button', { name: 'Back', exact: true }).click();
    await shell(page).getByRole('button', { name: 'Resume', exact: true }).click();
    await expectLine(page, 'Current safe line');
    expect((await save(page, 2)).state.effects).toBe(1);
    await page.keyboard.press('Space');
    await expectLine(page, 'Still pending');
});
