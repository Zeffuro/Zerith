import { expect, test } from '@playwright/test';

const firstLine = 'Every classic visual novel starts with a room, a choice, and a promise.';
const shell = page => page.locator('.zerith-player-shell');
const dialogue = page => page.locator('[role="status"]').filter({ hasText: firstLine });

async function setup(page, options = {}) {
    await page.addInitScript(({ native }) => {
        if (!native) return;
        globalThis.windowProbe = { calls: [], fail: false, fullscreen: false };
        globalThis.__ZERITH_DESKTOP__ = { gameId: 'games.eveningshift.g123456789abc', height: 720, title: 'Evening Shift', width: 1280 };
        globalThis.__TAURI_INTERNALS__ = { invoke: async (command, args) => {
            const probe = globalThis.windowProbe;
            if (command === 'desktop_set_fullscreen') {
                probe.calls.push(args.fullscreen);
                if (probe.fail) throw new Error('Window unavailable');
                probe.fullscreen = args.fullscreen;
            }
            return { fullscreen: probe.fullscreen, height: 720, maximized: false, width: 1280 };
        } };
    }, { native: options.native });
    await page.route('**/engine.config.json', async route => {
        const response = await route.fetch();
        const config = await response.json();
        config.accessibility = { ...config.accessibility, captions: true, reducedMotion: true, typewriterSpeedMultiplier: 0 };
        config.player = options.player ?? {};
        config.input = options.input ?? config.input;
        await route.fulfill({ json: config });
    });
    if (options.id) await page.route('**/game.json', async route => {
        const response = await route.fetch();
        await route.fulfill({ json: { ...await response.json(), id: options.id } });
    });
    await page.goto('http://127.0.0.1:1423/');
    await expect(shell(page).getByRole('heading', { level: 1 })).toBeVisible();
}

async function start(page) {
    await shell(page).getByRole('button', { name: 'New Game', exact: true }).click();
    await expect(shell(page)).toBeHidden();
    await expect(dialogue(page)).toHaveCount(1);
}

test('default menus save, continue, load and return to title without advancing on resume', async ({ page }, testInfo) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await setup(page);
    await expect(shell(page).getByRole('button', { name: 'Continue', exact: true })).toBeDisabled();
    await expect(page.locator('.zerith-desktop-display')).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath('title.png') });
    await start(page);
    await page.keyboard.down('Escape');
    await expect(shell(page).getByRole('heading', { name: 'Paused' })).toBeVisible();
    await page.keyboard.down('Escape');
    await expect(shell(page)).toBeVisible();
    await page.keyboard.up('Escape');
    await shell(page).getByRole('button', { name: 'Resume', exact: true }).focus();
    await page.keyboard.down(' ');
    await expect(shell(page)).toBeHidden();
    await page.keyboard.down(' ');
    await page.keyboard.up(' ');
    await expect(dialogue(page)).toHaveCount(1);
    await page.keyboard.press('s');
    await expect(shell(page).getByRole('heading', { name: 'Save game' })).toBeVisible();
    await shell(page).getByRole('button', { name: 'Slot 1', exact: false }).click();
    await expect(shell(page).getByRole('status')).toHaveText('Saved to slot 1.');
    await shell(page).getByRole('button', { name: 'Slot 1', exact: false }).click();
    await expect(shell(page).getByText('Replace the save in slot 1?')).toBeVisible();
    await shell(page).getByRole('button', { name: 'Cancel' }).click();
    await shell(page).getByRole('button', { name: 'Back', exact: true }).click();
    await shell(page).getByRole('button', { name: 'History', exact: true }).click();
    await expect(shell(page).getByText(firstLine, { exact: true })).toBeVisible();
    await shell(page).getByRole('button', { name: 'Back', exact: true }).click();
    await shell(page).getByRole('button', { name: 'Return to title' }).click();
    await shell(page).getByRole('button', { name: 'Cancel' }).click();
    await shell(page).getByRole('button', { name: 'Return to title' }).click();
    await shell(page).getByRole('button', { name: 'Confirm', exact: true }).click();
    await expect(shell(page).getByRole('button', { name: 'Continue', exact: true })).toBeEnabled();
    await shell(page).getByRole('button', { name: 'Continue', exact: true }).click();
    await expect(shell(page)).toBeHidden();
    await expect(dialogue(page)).toHaveCount(1);
    await page.keyboard.press('l');
    await shell(page).getByRole('button', { name: 'Slot 1', exact: false }).click();
    await expect(shell(page).getByText('Load this save? Progress since your last save will be lost.')).toBeVisible();
    await shell(page).getByRole('button', { name: 'Confirm', exact: true }).click();
    await expect(shell(page)).toBeHidden();
    await expect(dialogue(page)).toHaveCount(1);
    expect(errors).toEqual([]);
});

test('settings persist per game, update live text and reset to authored defaults', async ({ page }, testInfo) => {
    await setup(page, { id: 'evening-shift' });
    await shell(page).getByRole('button', { name: 'Settings', exact: true }).click();
    const master = shell(page).getByRole('slider', { name: 'Master volume' });
    await master.focus();
    await page.keyboard.press('Home');
    await page.keyboard.press('ArrowRight');
    await expect(master).toHaveValue('0.05');
    await page.screenshot({ path: testInfo.outputPath('settings.png') });
    await page.reload();
    await shell(page).getByRole('button', { name: 'Settings', exact: true }).click();
    await expect(master).toHaveValue('0.05');
    await shell(page).getByRole('button', { name: 'Back', exact: true }).click();
    await start(page);
    await page.keyboard.press('Escape');
    await shell(page).getByRole('button', { name: 'Settings', exact: true }).click();
    const textSize = shell(page).getByRole('slider', { name: 'Text size' });
    await textSize.focus();
    await page.keyboard.press('End');
    await expect(textSize).toHaveValue('40');
    await shell(page).getByRole('button', { name: 'Back', exact: true }).click();
    await shell(page).getByRole('button', { name: 'Resume', exact: true }).click();
    await expect(dialogue(page)).toHaveCount(1);
    await page.keyboard.press('Escape');
    await shell(page).getByRole('button', { name: 'Settings', exact: true }).click();
    await shell(page).getByRole('button', { name: 'Reset settings' }).click();
    await expect(master).toHaveValue('1');
    await expect(textSize).toHaveValue('25');
    expect(await page.evaluate(() => Object.keys(localStorage).some(key => key.startsWith('zerith:web:evening-shift:')))).toBe(true);
});

test('custom menus, labels, slots and separate identities apply to the real player', async ({ page }) => {
    await setup(page, { id: 'late-train', input: { menuKey: 'p', backKeys: ['Escape'] },
        player: { title: 'Late Train', subtitle: 'A station after closing', titleActions: ['settings'], pauseActions: ['resume', 'save'], saveSlots: 2, actionLabels: { 'new-game': 'Start', resume: 'Keep playing' }, accentColor: '#88aacc' } });
    await expect(shell(page).getByRole('heading', { name: 'Late Train' })).toBeVisible();
    await expect(shell(page).getByText('A station after closing')).toBeVisible();
    await expect(shell(page).getByRole('button', { name: 'Continue', exact: true })).toHaveCount(0);
    await shell(page).getByRole('button', { name: 'Start', exact: true }).focus();
    await page.keyboard.press('Enter');
    await expect(shell(page)).toBeHidden();
    await expect(dialogue(page)).toHaveCount(1);
    await page.keyboard.press('p');
    await expect(shell(page).getByRole('button', { name: 'Keep playing' })).toBeVisible();
    await shell(page).getByRole('button', { name: 'Save', exact: true }).click();
    await expect(shell(page).locator('.zerith-shell-slot')).toHaveCount(2);
    await page.keyboard.press('Escape');
    await expect(shell(page).getByRole('heading', { name: 'Paused' })).toBeVisible();
});

test('display lives in Settings, reports failures and keeps Escape available in fullscreen', async ({ page }) => {
    await setup(page, { native: true });
    await start(page);
    await page.keyboard.press('F11');
    await expect.poll(() => page.evaluate(() => globalThis.windowProbe.fullscreen)).toBe(true);
    await page.keyboard.press('Escape');
    await expect(shell(page).getByRole('heading', { name: 'Paused' })).toBeVisible();
    expect(await page.evaluate(() => globalThis.windowProbe.fullscreen)).toBe(true);
    await shell(page).getByRole('button', { name: 'Settings', exact: true }).click();
    await page.evaluate(() => { globalThis.windowProbe.fail = true; });
    await shell(page).getByRole('button', { name: 'Windowed', exact: true }).click();
    await expect(shell(page).getByRole('status').filter({ hasText: 'Window unavailable' })).toBeVisible();
    await page.evaluate(() => { globalThis.windowProbe.fail = false; });
    await shell(page).getByRole('button', { name: 'Windowed', exact: true }).click();
    await expect.poll(() => page.evaluate(() => globalThis.windowProbe.fullscreen)).toBe(false);
    await page.keyboard.press('Alt+Enter');
    await expect.poll(() => page.evaluate(() => globalThis.windowProbe.fullscreen)).toBe(true);
    await expect(dialogue(page)).toHaveCount(1);
});

test('touch hold and right-click open pause with no permanent button', async ({ page }) => {
    await setup(page);
    await start(page);
    const touch = await page.context().newCDPSession(page);
    const bounds = await page.locator('canvas').boundingBox();
    await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }] });
    await expect(shell(page).getByRole('heading', { name: 'Paused' })).toBeVisible();
    await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect(shell(page).getByRole('heading', { name: 'Paused' })).toBeVisible();
    await shell(page).getByRole('button', { name: 'Resume', exact: true }).click();
    await expect(dialogue(page)).toHaveCount(1);
    await page.locator('canvas').click({ button: 'right', position: { x: 100, y: 100 } });
    await expect(shell(page).getByRole('heading', { name: 'Paused' })).toBeVisible();
    await expect(dialogue(page)).toHaveCount(1);
});


test('gamepad menus handle focus, confirm, back and held buttons on resume', async ({ page }) => {
    await page.addInitScript(() => {
        globalThis.padProbe = { axes: [0, 0], buttons: Array.from({ length: 16 }, () => ({ pressed: false })) };
        Object.defineProperty(navigator, 'getGamepads', { value: () => [globalThis.padProbe] });
    });
    await setup(page);
    await start(page);
    await page.evaluate(() => { globalThis.padProbe.buttons[9].pressed = true; });
    await expect(shell(page).getByRole('heading', { name: 'Paused' })).toBeVisible();
    await shell(page).getByRole('button', { name: 'Resume', exact: true }).click();
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await expect(shell(page)).toBeHidden();
    await expect(dialogue(page)).toHaveCount(1);
    await page.evaluate(() => { globalThis.padProbe.buttons[9].pressed = false; });
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await page.evaluate(() => { globalThis.padProbe.buttons[9].pressed = true; });
    await expect(shell(page).getByRole('heading', { name: 'Paused' })).toBeVisible();
    await page.evaluate(() => { globalThis.padProbe.buttons[9].pressed = false; globalThis.padProbe.buttons[13].pressed = true; });
    await expect(shell(page).getByRole('button', { name: 'Save', exact: true })).toBeFocused();
    await page.evaluate(() => { globalThis.padProbe.buttons[13].pressed = false; globalThis.padProbe.buttons[0].pressed = true; });
    await expect(shell(page).getByRole('heading', { name: 'Save game' })).toBeVisible();
    await page.evaluate(() => { globalThis.padProbe.buttons[0].pressed = false; globalThis.padProbe.buttons[1].pressed = true; });
    await expect(shell(page).getByRole('heading', { name: 'Paused' })).toBeVisible();
});

test('Auto-Advance enabled in Settings holds the current line until resume', async ({ page }) => {
    await setup(page);
    await start(page);
    await page.keyboard.press('Escape');
    await shell(page).getByRole('button', { name: 'Settings', exact: true }).click();
    await shell(page).getByRole('checkbox', { name: 'Auto-Advance' }).check();
    await page.waitForTimeout(1700);
    await expect(dialogue(page)).toHaveCount(1);
    await shell(page).getByRole('button', { name: 'Back', exact: true }).click();
    await shell(page).getByRole('button', { name: 'Resume', exact: true }).click();
    await expect(page.locator('[role="status"]').filter({ hasText: 'The promise is simple: every line should be easy to find again.' })).toHaveCount(1);
});


test('save write failures preserve the existing slot and keep the menu usable', async ({ page }) => {
    await setup(page, { id: 'platform-four' });
    await start(page);
    await page.keyboard.press('s');
    await shell(page).getByRole('button', { name: 'Slot 1', exact: false }).click();
    await expect(shell(page).getByRole('status')).toHaveText('Saved to slot 1.');
    const original = await page.evaluate(() => localStorage.getItem('zerith:web:platform-four:zerith_save_1'));
    await page.evaluate(() => {
        const write = Storage.prototype.setItem;
        Storage.prototype.setItem = function(key, value) {
            if (key.endsWith(':zerith_save_1')) throw new DOMException('Storage is full.', 'QuotaExceededError');
            return write.call(this, key, value);
        };
    });
    await shell(page).getByRole('button', { name: 'Slot 1', exact: false }).click();
    await shell(page).getByRole('button', { name: 'Confirm', exact: true }).click();
    await expect(shell(page).getByRole('status')).toHaveText('Storage is full.');
    expect(await page.evaluate(() => localStorage.getItem('zerith:web:platform-four:zerith_save_1'))).toBe(original);
    await shell(page).getByRole('button', { name: 'Cancel' }).click();
    await expect(shell(page).getByRole('heading', { name: 'Save game' })).toBeVisible();
});


test('authored menu appearance reaches title and pause with responsive controls', async ({ page }) => {
    await setup(page, { player: {
        titleAlignment: 'right', menuFont: 'serif', menuFontSize: 20, menuWidth: 500,
        buttonHeight: 60, cornerStyle: 'pill', panelColor: '#123456', panelOpacity: .8,
        textColor: '#eeeeee', buttonColor: '#654321', backgroundOpacity: .3,
    } });
    const root = shell(page);
    await expect(root).toHaveAttribute('data-title-alignment', 'right');
    const appearance = await root.evaluate(element => {
        const panel = element.querySelector('.zerith-shell-panel');
        const button = element.querySelector('.zerith-shell-menu button:last-child');
        const style = getComputedStyle(element);
        return { font: style.fontFamily, size: style.fontSize, color: style.color,
            panel: getComputedStyle(panel).backgroundColor, radius: getComputedStyle(button).borderRadius,
            height: button.getBoundingClientRect().height, button: getComputedStyle(button).backgroundColor,
            fits: element.scrollWidth <= element.clientWidth };
    });
    expect(appearance).toMatchObject({ font: 'Georgia, serif', size: '20px', color: 'rgb(238, 238, 238)',
        panel: 'rgba(18, 52, 86, 0.8)', radius: '999px', button: 'rgb(101, 67, 33)', fits: true });
    expect(appearance.height).toBeGreaterThanOrEqual(60);
    await start(page);
    await page.keyboard.press('Escape');
    await expect(root.getByRole('heading', { name: 'Paused' })).toBeVisible();
    expect(await root.getByRole('button', { name: 'Resume', exact: true }).evaluate(element => getComputedStyle(element).minHeight)).toBe('60px');
});
