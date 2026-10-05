import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { chromium } from '@playwright/test';

const [endpoint, output, fixture = 'classic-vn-starter'] = process.argv.slice(2);
const expected = fixture === 'example-game' ? [
    'Rain on the glass, two case files on the desk, and one very patient renderer.',
    'I moved everything clean into this folder.',
] : [
    'Every classic visual novel starts with a room, a choice, and a promise.',
    'The promise is simple: every line should be easy to find again.',
];
if (!endpoint || !output || !['classic-vn-starter', 'example-game'].includes(fixture)) throw new Error('Use <CDP endpoint> <new receipt directory> [classic-vn-starter|example-game]');
fs.mkdirSync(output);
const browser = await chromium.connectOverCDP(endpoint);
const errors = [];
const page = browser.contexts()[0].pages()[0];
try {
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
    await page.waitForURL('http://game.localhost/**');
    await page.waitForFunction(() => document.querySelector('canvas')?.width === 1280);
    await page.addInitScript(() => {
        const fetchOriginal = globalThis.fetch.bind(globalThis);
        globalThis.fetch = async (...args) => {
            const response = await fetchOriginal(...args);
            if (!String(args[0]).includes('engine.config.json') || !response.ok) return response;
            const config = await response.json();
            config.accessibility = { ...config.accessibility, captions: true, selfVoicing: true, reducedMotion: true, typewriterSpeedMultiplier: 0 };
            return new Response(JSON.stringify(config), { status: 200, headers: { 'content-type': 'application/json' } });
        };
    });
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForFunction(() => document.querySelector('canvas')?.width === 1280);
    await page.locator('.zerith-player-shell').getByRole('button', { name: 'New Game', exact: true }).click();
    for (const [index, text] of expected.entries()) {
        if (index > 0) await page.keyboard.press('Enter');
        const deadline = Date.now() + 15_000;
        while (true) {
            try {
                await page.waitForFunction((value) => [...document.querySelectorAll('[role=status]')].some((element) => element.textContent.includes(value)), text, { timeout: 1000 });
                break;
            } catch (error) {
                if (Date.now() >= deadline) throw error;
                await page.keyboard.press('Enter');
            }
        }
        await page.screenshot({ path: path.join(output, `dialogue-${index + 1}.png`) });
    }
    assert.deepEqual(errors, []);
    const display = page.locator('.zerith-player-shell');
    const dialogue = page.locator('[role=status]').filter({ hasText: expected[1] });
    const windowState = () => page.evaluate(() => globalThis.__TAURI_INTERNALS__.invoke('desktop_get_window_state'));
    const waitForMode = async (fullscreen) => {
        await page.waitForFunction(async (value) => (await globalThis.__TAURI_INTERNALS__.invoke('desktop_get_window_state')).fullscreen === value, fullscreen);
        assert.equal(await dialogue.count(), 1);
    };
    assert.equal(await page.locator('.zerith-desktop-display').count(), 0);
    await page.keyboard.press('Escape');
    await display.getByRole('button', { name: 'Settings', exact: true }).click();
    await display.getByRole('button', { name: 'Fullscreen', exact: true }).click();
    await waitForMode(true);
    await display.getByRole('button', { name: 'Windowed', exact: true }).click();
    await waitForMode(false);
    await page.keyboard.press('F11');
    await waitForMode(true);
    await page.keyboard.down('Escape');
    await display.getByRole('heading', { name: 'Paused' }).waitFor();
    await page.keyboard.down('Escape');
    await page.keyboard.up('Escape');
    await waitForMode(true);
    await page.keyboard.press('Alt+Enter');
    await waitForMode(false);
    await display.getByRole('button', { name: 'Settings', exact: true }).click();
    const textSize = display.getByRole('slider', { name: 'Text size' });
    await textSize.focus();
    await page.keyboard.press('End');
    assert.equal(await textSize.inputValue(), '40');
    await page.screenshot({ path: path.join(output, 'display-controls.png') });
    await display.getByRole('button', { name: 'Back', exact: true }).click();
    await display.getByRole('button', { name: 'Save', exact: true }).click();
    await display.getByRole('button', { name: 'Slot 1', exact: false }).click();
    await display.getByRole('button', { name: 'Back', exact: true }).click();
    await display.getByRole('button', { name: 'Return to title' }).click();
    await display.getByRole('button', { name: 'Confirm', exact: true }).click();
    await page.reload({ waitUntil: 'networkidle' });
    await display.getByRole('button', { name: 'Settings', exact: true }).click();
    assert.equal(await textSize.inputValue(), '40');
    await display.getByRole('button', { name: 'Back', exact: true }).click();
    await display.getByRole('button', { name: 'Continue', exact: true }).click();
    await page.waitForFunction(value => [...document.querySelectorAll('[role=status]')].some(element => element.textContent.includes(value)), expected[1]);
    assert.equal(await dialogue.count(), 1);
    const finalWindow = await windowState();
    const access = await page.evaluate(async () => {
        try { await globalThis.__TAURI_INTERNALS__.invoke('plugin:fs|read_text_file', { path: 'C:/Windows/win.ini' }); return 'allowed'; }
        catch { return 'denied'; }
    });
    assert.equal(access, 'denied');
    assert.deepEqual(errors, []);
    const receipt = { status: 'passed', fixture, url: page.url(), dialogues: expected, displayControls: 'passed', finalWindow, authoringAccess: access, runtimeErrors: [], permissionErrors: errors };
    fs.writeFileSync(path.join(output, 'receipt.json'), JSON.stringify(receipt, null, 2));
    console.log(JSON.stringify(receipt));
} catch (error) {
    await page.screenshot({ path: path.join(output, 'failure.png') });
    fs.writeFileSync(path.join(output, 'failure.json'), JSON.stringify({ error: error.message, runtimeErrors: errors, statusTexts: await page.locator('[role=status]').allTextContents() }, null, 2));
    throw error;
} finally {
    await browser.close();
}

