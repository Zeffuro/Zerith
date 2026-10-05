import { expect, test } from '@playwright/test';

const shell = page => page.locator('.zerith-player-shell');

async function setup(page) {
    await page.route('**/background-ownership.html', route => route.fulfill({ contentType: 'text/html', body: '<html><body style="margin:0"><canvas id="game"></canvas></body></html>' }));
    await page.route('**/ownership-game.json', route => route.fulfill({ json: {
        schemaVersion: 2, id: 'background-ownership-check', title: 'Background ownership', startScene: 'intro',
        scenes: { intro: { schemaVersion: 2, commands: [
            { type: 'background', assetUrl: '/ownership-B.svg' },
            { type: 'dialogue', speaker: 'Narrator', text: 'Current background B', instant: true },
        ] } },
    } }));
    await page.route('**/ownership-*.svg', route => route.fulfill({ contentType: 'image/svg+xml',
        body: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" fill="${route.request().url().includes('ownership-A') ? '#ff0000' : '#0000ff'}"/></svg>` }));
    await page.goto('http://127.0.0.1:1423/background-ownership.html');
    await page.evaluate(async () => {
        const { bootstrapPlayer } = await import('/src/runtime/bootstrapPlayer.ts');
        const { createDefaultPlayerShell } = await import('/src/runtime/playerShell.ts');
        window.backgroundBoot = bootstrapPlayer({ canvas: document.querySelector('canvas'), manifestUrl: '/ownership-game.json',
            configUrl: false, compiledContentUrl: false, prefetchCompiledAssets: false, preloadAssets: false, defaultBlipUrl: null,
            config: { accessibility: { captions: true, typewriterSpeedMultiplier: 0 }, display: { width: 320, height: 180 }, player: {} },
            shell: context => { window.backgroundEngine = context.engine; return createDefaultPlayerShell(context); },
        });
    });
    await shell(page).getByRole('button', { name: 'New Game', exact: true }).click();
    await expect(page.locator('[role="status"]').filter({ hasText: 'Current background B' })).toHaveCount(1);
    await page.evaluate(() => window.backgroundBoot.then(() => {}));
}

async function startPending(page, outcome) {
    await page.evaluate(async outcome => {
        const engine = window.backgroundEngine;
        const handler = engine.flow.getHandler('background');
        const load = engine.assets.load.bind(engine.assets);
        let ready;
        const entered = new Promise(resolve => { ready = resolve; });
        const gate = new Promise(resolve => { window.releaseBackground = resolve; });
        engine.assets.load = async url => {
            const texture = await load(url);
            if (url === '/ownership-A.svg') {
                ready();
                await gate;
                if (outcome === 'failure') throw new Error('stale background failure');
            }
            return texture;
        };
        window.oldBackground = handler.execute({ type: 'background', assetUrl: '/ownership-A.svg' })
            .then(() => ({ completed: true }), error => ({ error: String(error) }));
        await entered;
    }, outcome);
}

async function backgroundState(page) {
    return page.evaluate(async () => {
        const engine = window.backgroundEngine;
        const layer = engine.display.getLayer('background');
        const thumbnail = engine.display.captureThumbnailDataUrl();
        let pixel;
        if (thumbnail) {
            const image = new Image();
            image.src = thumbnail;
            await image.decode();
            const canvas = document.createElement('canvas');
            canvas.width = image.width;
            canvas.height = image.height;
            const context = canvas.getContext('2d');
            context.drawImage(image, 0, 0);
            pixel = [...context.getImageData(2, 2, 1, 1).data];
        }
        return { background: engine.stateManager.system.background ?? null, children: layer.children.length, pixel };
    });
}

for (const operation of ['reset', 'load-background', 'load-empty', 'new-game', 'destroy']) {
    for (const outcome of ['success', 'failure']) {
        test(`${operation} owns the background after a stale ${outcome}`, async ({ page }, testInfo) => {
            const errors = [];
            page.on('pageerror', error => errors.push(String(error)));
            await setup(page);
            await startPending(page, outcome);
            if (operation === 'new-game') {
                await page.keyboard.press('Escape');
                await shell(page).getByRole('button', { name: 'Return to title', exact: true }).click();
                await shell(page).getByRole('button', { name: 'Confirm', exact: true }).click();
                await shell(page).getByRole('button', { name: 'New Game', exact: true }).click();
                await expect(shell(page)).toBeHidden();
                await expect(page.locator('[role="status"]').filter({ hasText: 'Current background B' })).toHaveCount(1);
            } else {
                await page.evaluate(async operation => {
                    const engine = window.backgroundEngine;
                    if (operation === 'destroy') { engine.destroy(); return; }
                    if (operation === 'reset') {
                        engine.flow.getHandler('background').reset();
                        await engine.flow.getHandler('background').execute({ type: 'background', assetUrl: '/ownership-B.svg' });
                        return;
                    }
                    const system = JSON.parse(JSON.stringify(engine.stateManager.system));
                    system.background = operation === 'load-empty' ? undefined : '/ownership-B.svg';
                    await engine.applySaveState({ saveSchemaVersion: 2, sceneName: 'intro', index: 1, state: {}, system,
                        meta: { savedAt: 0, sceneName: 'intro', slot: 1 } });
                }, operation);
            }
            const visible = !['destroy', 'load-empty'].includes(operation);
            await expect.poll(async () => (await backgroundState(page)).children).toBe(visible ? 1 : 0);
            expect(await page.evaluate(async () => { window.releaseBackground(); return await window.oldBackground; })).toEqual({ completed: true });
            const state = await backgroundState(page);
            expect(state.children).toBe(visible ? 1 : 0);
            expect(state.background).toBe(visible ? '/ownership-B.svg' : null);
            if (visible) {
                expect(state.pixel[0]).toBeLessThan(10);
                expect(state.pixel[1]).toBeLessThan(10);
                expect(state.pixel[2]).toBeGreaterThan(245);
                expect(state.pixel[3]).toBe(255);
            }
            expect(errors).toEqual([]);
            if (operation === 'new-game' && outcome === 'success') await page.screenshot({ path: testInfo.outputPath('background-B-retained.png') });
            if (operation !== 'destroy') await page.evaluate(() => window.backgroundEngine.destroy());
        });
    }
}
