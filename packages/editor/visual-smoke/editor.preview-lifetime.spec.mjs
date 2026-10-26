import { expect } from '@playwright/test';
import { dock, mountFixture, openFixture, readFixture, replaceJson, setup, test } from './authoringHelpers.mjs';

async function ready(page, root) {
    await dock(page, 'preview');
    await expect.poll(() => page.evaluate(async root => {
        const { useEngineBridgeStore } = await import('/src/store/useEngineBridgeStore.ts');
        const engine = useEngineBridgeStore.getState().engine;
        return !!engine && engine.stateManager.getPersistent('projectPath') === root && engine.display.app.ticker?.started;
    }, root)).toBe(true);
}

async function fixture(page) {
    const files = await readFixture('classic-vn-starter');
    replaceJson(files, 'engine.config.json', config => ({ ...config, audio: { ...config.audio, defaultBlipUrl: null } }));
    const first = await mountFixture(page, files);
    const second = await mountFixture(page, files);
    await openFixture(page, first);
    await ready(page, first);
    return { first, second };
}

async function pointerTarget(page) {
    await page.evaluate(async () => {
        const { useEngineBridgeStore } = await import('/src/store/useEngineBridgeStore.ts');
        const engine = useEngineBridgeStore.getState().engine;
        const layer = engine.display.getLayer('overlay');
        const source = await (await fetch('/src/services/previewFont.ts')).text();
        const dependency = source.match(/import \{ CanvasTextMetrics \} from ["']([^"']+)["']/)[1];
        const { Graphics } = await import(dependency);
        const target = new layer.constructor();
        target.addChild(new Graphics().rect(0, 0, engine.display.width, engine.display.height).fill(0x33_66_99));
        target.eventMode = 'static';
        target.hitArea = { contains: (x, y) => x >= 0 && y >= 0 && x <= engine.display.width && y <= engine.display.height };
        globalThis.__pointerHits = 0;
        target.on('pointerdown', () => { globalThis.__pointerHits++; });
        layer.addChild(target);
        engine.display.render();
    });
}

async function clickCanvas(page) {
    const canvas = page.getByRole('application', { name: /^Game preview(?: playback)?$/ }).locator('canvas');
    const rect = await canvas.boundingBox();
    await page.mouse.click(rect.x + rect.width / 2, rect.y + rect.height / 2);
}

async function delayRenderer(page, phase, outcome) {
    await page.evaluate(async ({ phase, outcome }) => {
        const { useEngineBridgeStore } = await import('/src/store/useEngineBridgeStore.ts');
        const current = useEngineBridgeStore.getState().engine;
        let started, release, settled;
        const state = globalThis.__lifetime = {
            attached: 0, disposed: 0,
            started: new Promise(resolve => { started = resolve; }),
            settled: new Promise(resolve => { settled = resolve; }),
        };
        const pending = new Promise(resolve => { release = resolve; });
        state.release = release;
        const enginePrototype = Object.getPrototypeOf(current);
        const initEngine = enginePrototype.init;
        enginePrototype.init = function (canvas) {
            enginePrototype.init = initEngine;
            state.engine = this;
            state.canvas = canvas;
            const attach = this.input.attach;
            this.input.attach = (...args) => { state.attached++; return attach.apply(this.input, args); };
            return initEngine.call(this, canvas).finally(settled);
        };
        const rendererPrototype = Object.getPrototypeOf(current.display.app.renderer);
        const initRenderer = rendererPrototype.init;
        rendererPrototype.init = async function (options) {
            rendererPrototype.init = initRenderer;
            const destroy = this.destroy;
            this.destroy = (...args) => { state.disposed++; return destroy.apply(this, args); };
            if (phase === 'before') {
                started();
                await pending;
                await initRenderer.call(this, options);
            } else {
                await initRenderer.call(this, options);
                state.gl = this.gl;
                started();
                await pending;
            }
            state.gl ??= this.gl;
            if (outcome === 'failure') throw new Error('injected stale renderer initialization failure');
        };
    }, { phase, outcome });
}

test.describe('preview renderer lifetime', () => {
    test.beforeEach(async ({ page }) => {
        page.__lifetimeErrors = [];
        page.on('pageerror', error => page.__lifetimeErrors.push(error.message));
        await setup(page);
    });
    test.afterEach(async ({ page }) => { expect(page.__lifetimeErrors).toEqual([]); });

    test('reopening and every bootstrap identity use a fresh canvas and release the old context', async ({ page }) => {
        const { first } = await fixture(page);
        for (const change of ['reopen', 'manifest', 'locale', 'reload']) {
            await page.evaluate(async () => {
                const { useEngineBridgeStore } = await import('/src/store/useEngineBridgeStore.ts');
                const engine = useEngineBridgeStore.getState().engine;
                globalThis.__retired = { canvas: engine.display.canvas, engine, gl: engine.display.app.renderer.gl };
            });
            if (change === 'reopen') await openFixture(page, first);
            else await page.evaluate(async change => {
                const { useProjectStore } = await import('/src/store/storeBootstrap.ts');
                if (change === 'manifest') useProjectStore.setState(state => ({ manifest: { ...state.manifest } }));
                if (change === 'locale') useProjectStore.setState(state => ({ localePaths: { ...state.localePaths, probe: 'locales/probe.json' } }));
                if (change === 'reload') useProjectStore.setState(state => ({ treeRevision: state.treeRevision + 1 }));
            }, change);
            await ready(page, first);
            await expect.poll(() => page.evaluate(async () => {
                const { useEngineBridgeStore } = await import('/src/store/useEngineBridgeStore.ts');
                const current = useEngineBridgeStore.getState().engine;
                return current !== globalThis.__retired.engine && current.display.canvas !== globalThis.__retired.canvas;
            }), { message: change }).toBe(true);
            expect(await page.evaluate(() => ({ attached: globalThis.__retired.canvas.isConnected,
                contextLost: globalThis.__retired.gl.isContextLost(), ticker: globalThis.__retired.engine.display.app.ticker }))).toEqual({ attached: false, contextLost: true, ticker: null });
            await pointerTarget(page);
            await clickCanvas(page);
            expect(await page.evaluate(() => globalThis.__pointerHits)).toBe(1);
        }
    });

    for (const phase of ['before', 'after']) for (const outcome of ['success', 'failure']) {
        test(`late renderer ${outcome} ${phase} system initialization preserves successor pixels and pointer events`, async ({ page }, info) => {
            const { first, second } = await fixture(page);
            await delayRenderer(page, phase, outcome);
            await openFixture(page, second);
            await page.evaluate(() => globalThis.__lifetime.started);
            await openFixture(page, first);
            await ready(page, first);
            await pointerTarget(page);
            await clickCanvas(page);
            const canvas = page.getByRole('application', { name: /^Game preview(?: playback)?$/ }).locator('canvas');
            const bounds = await canvas.boundingBox();
            const clip = { height: bounds.height - 4, width: bounds.width - 4, x: bounds.x + 2, y: bounds.y + 2 };
            const before = await page.screenshot({ clip, path: info.outputPath('before.png') });
            await page.evaluate(() => globalThis.__lifetime.release());
            await page.evaluate(() => globalThis.__lifetime.settled);
            await expect.poll(() => page.evaluate(() => globalThis.__lifetime.disposed)).toBe(1);
            expect(await page.evaluate(() => ({ attached: globalThis.__lifetime.attached,
                contextReleased: !globalThis.__lifetime.gl || globalThis.__lifetime.gl.isContextLost(), ticker: !!globalThis.__lifetime.engine.display.app.ticker }))).toEqual({ attached: 0, contextReleased: true, ticker: false });
            expect(before.equals(await page.screenshot({ clip, path: info.outputPath('after.png') }))).toBe(true);
            await clickCanvas(page);
            expect(await page.evaluate(() => globalThis.__pointerHits)).toBe(2);
            expect(await page.evaluate(async () => {
                const { useEngineBridgeStore } = await import('/src/store/useEngineBridgeStore.ts');
                const current = useEngineBridgeStore.getState().engine;
                return { contextLost: current.display.app.renderer.gl.isContextLost(), fresh: current.display.canvas !== globalThis.__lifetime.canvas, running: current.display.app.ticker.started };
            })).toEqual({ contextLost: false, fresh: true, running: true });
        });
    }

    test('late teardown preserves shared textures and current audio with the same logical URL', async ({ page }) => {
        const { first, second } = await fixture(page);
        await page.evaluate(async () => {
            const { useEngineBridgeStore } = await import('/src/store/useEngineBridgeStore.ts');
            const engine = useEngineBridgeStore.getState().engine;
            const bytes = new Uint8Array(44 + 16_000);
            const view = new DataView(bytes.buffer);
            const text = (offset, value) => [...value].forEach((char, index) => { bytes[offset + index] = char.charCodeAt(0); });
            text(0, 'RIFF'); view.setUint32(4, bytes.length - 8, true); text(8, 'WAVE'); text(12, 'fmt ');
            view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
            view.setUint32(24, 8000, true); view.setUint32(28, 16000, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
            text(36, 'data'); view.setUint32(40, bytes.length - 44, true);
            const url = URL.createObjectURL(new Blob([bytes], { type: 'audio/wav' }));
            const external = new engine.audio.constructor();
            await external.playBgm(url, true);
            const image = document.createElement('canvas');
            image.width = 2; image.height = 2;
            image.getContext('2d').fillRect(0, 0, 2, 2);
            const textureUrl = image.toDataURL();
            const texture = await engine.assets.load(textureUrl);
            globalThis.__shared = { external, texture, textureUrl, url };
        });
        await openFixture(page, second);
        await ready(page, second);
        await page.evaluate(async () => {
            const { useEngineBridgeStore } = await import('/src/store/useEngineBridgeStore.ts');
            const engine = useEngineBridgeStore.getState().engine;
            const { external, texture, textureUrl, url } = globalThis.__shared;
            await engine.audio.playBgm(url, true);
            globalThis.__shared.currentSound = engine.audio.audio.get(url).sound;
            globalThis.__shared.sameTexture = await engine.assets.load(textureUrl) === texture;
            external.stopAll(); external.muted = true; external.setMasterVolume(0); external.destroy();
        });
        expect(await page.evaluate(() => ({ sameTexture: globalThis.__shared.sameTexture,
            textureDestroyed: globalThis.__shared.texture.destroyed, sourceDestroyed: globalThis.__shared.texture.source.destroyed,
            audioPlaying: globalThis.__shared.currentSound.isPlaying, volume: globalThis.__shared.currentSound.volume }))).toEqual({ sameTexture: true, textureDestroyed: false, sourceDestroyed: false, audioPlaying: true, volume: 1 });
        await pointerTarget(page);
        await clickCanvas(page);
        expect(await page.evaluate(() => globalThis.__pointerHits)).toBe(1);
        await page.evaluate(async () => {
            const { useEngineBridgeStore } = await import('/src/store/useEngineBridgeStore.ts');
            useEngineBridgeStore.getState().engine.audio.stopBgm();
            URL.revokeObjectURL(globalThis.__shared.url);
        });
    });
});
