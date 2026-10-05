import { expect, test } from '@playwright/test';
import path from 'node:path';

const controlsModule = `/@fs/${path.resolve('packages/player/src/runtime/desktopDisplayControls.ts').replaceAll('\\', '/')}`;

async function setup(page, delayed = false) {
    await page.goto('/');
    await page.locator('.zerith-dock-host').waitFor();
    await page.evaluate(async ({ module, delayed }) => {
        const { createPlayerDisplayControls } = await import(module);
        const state = { fullscreen: false, height: 720, maximized: false, width: 1280 };
        const probe = { advances: [], calls: [], failed: false, initial: undefined, state };
        globalThis.desktopProbe = probe;
        probe.controls = createPlayerDisplayControls({
            getState: () => delayed ? new Promise(resolve => { probe.initial = resolve; }) : Promise.resolve({ ...state }),
            metadata: { gameId: 'games.eveningshift.g123456789abc', height: 720, title: 'Evening Shift', width: 1280 },
            setFullscreen: async value => {
                probe.calls.push(value);
                if (probe.failed) throw new Error('Window unavailable');
                state.fullscreen = value;
                return { ...state };
            },
        });
        globalThis.addEventListener('keydown', event => { if (event.key === 'Enter') probe.advances.push(event.key); });
    }, { delayed, module: controlsModule });
}

test('display controller handles native failures and permits retry without installing a HUD', async ({ page }) => {
    await setup(page);
    await page.evaluate(async () => { globalThis.desktopProbe.failed = true; await globalThis.desktopProbe.controls.setFullscreen(true); });
    expect(await page.evaluate(() => globalThis.desktopProbe.controls.getState())).toMatchObject({ pending: false, status: 'Window unavailable' });
    await page.evaluate(async () => { globalThis.desktopProbe.failed = false; await globalThis.desktopProbe.controls.setFullscreen(true); });
    expect(await page.evaluate(() => globalThis.desktopProbe.controls.getState())).toMatchObject({ fullscreen: true, status: '' });
    await expect(page.locator('.zerith-desktop-display')).toHaveCount(0);
});

test('held fullscreen shortcuts do not advance dialogue', async ({ page }) => {
    await setup(page);
    await page.keyboard.press('F11');
    await expect.poll(() => page.evaluate(() => globalThis.desktopProbe.state.fullscreen)).toBe(true);
    await page.keyboard.down('Alt');
    await page.keyboard.down('Enter');
    await expect.poll(() => page.evaluate(() => globalThis.desktopProbe.state.fullscreen)).toBe(false);
    await page.keyboard.down('Enter');
    await page.keyboard.up('Enter');
    await page.keyboard.up('Alt');
    expect(await page.evaluate(() => globalThis.desktopProbe.calls)).toEqual([true, false]);
    expect(await page.evaluate(() => globalThis.desktopProbe.advances)).toEqual([]);
});

test('stale reads cannot replace a fullscreen change and disposal removes shortcuts', async ({ page }) => {
    await setup(page, true);
    await page.keyboard.press('F11');
    await expect.poll(() => page.evaluate(() => globalThis.desktopProbe.state.fullscreen)).toBe(true);
    await page.evaluate(() => globalThis.desktopProbe.initial({ fullscreen: false, height: 720, maximized: false, width: 1280 }));
    await page.keyboard.press('F11');
    await expect.poll(() => page.evaluate(() => globalThis.desktopProbe.calls)).toEqual([true, false]);
    await page.evaluate(() => globalThis.desktopProbe.controls.dispose());
    await page.keyboard.press('F11');
    expect(await page.evaluate(() => globalThis.desktopProbe.calls)).toEqual([true, false]);
});

