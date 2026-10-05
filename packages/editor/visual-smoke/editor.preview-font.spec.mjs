import { expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { dock, mountFixture, openFixture, readFixture, replaceJson, setup, test } from './authoringHelpers.mjs';

const family = 'PreviewOwnershipProbe';
const fontPath = 'fonts/shared.ttf';

function checksum(bytes) {
    let sum = 0;
    for (let index = 0; index < bytes.length; index += 4) {
        let word = 0;
        for (let part = 0; part < 4; part++) word = word * 256 + (bytes[index + part] ?? 0);
        sum = (sum + word) >>> 0;
    }
    return sum;
}

async function fontBytes(scale) {
    const bytes = Buffer.from(await readFile('node_modules/monaco-editor/esm/vs/base/browser/ui/codicons/codicon/codicon.ttf'));
    const tables = new Map();
    for (let index = 0; index < bytes.readUInt16BE(4); index++) {
        const entry = 12 + index * 16;
        tables.set(bytes.toString('ascii', entry, entry + 4), { entry, length: bytes.readUInt32BE(entry + 12), offset: bytes.readUInt32BE(entry + 8) });
    }
    const head = tables.get('head');
    const hmtx = tables.get('hmtx');
    const count = bytes.readUInt16BE(tables.get('hhea').offset + 34);
    for (let index = 0; index < count; index++) bytes.writeUInt16BE(bytes.readUInt16BE(hmtx.offset + index * 4) * scale, hmtx.offset + index * 4);
    bytes.writeUInt32BE(0, head.offset + 8);
    for (const { entry, length, offset } of tables.values()) bytes.writeUInt32BE(checksum(bytes.subarray(offset, offset + length)), entry + 4);
    bytes.writeUInt32BE((0xB1B0AFBA - checksum(bytes)) >>> 0, head.offset + 8);
    return bytes.toString('base64');
}

async function projects(page, name) {
    const files = await readFixture(name);
    replaceJson(files, 'engine.config.json', config => ({ ...config, audio: { ...config.audio, defaultBlipUrl: null }, preview: { ...config.preview, fontAssetUrl: `/${fontPath}` }, theme: { ...config.theme, fontFamily: family } }));
    files[fontPath] = await fontBytes(1);
    const first = await mountFixture(page, files);
    files[fontPath] = await fontBytes(2);
    const second = await mountFixture(page, files);
    return { first, second };
}

async function state(page) {
    return page.evaluate(async family => {
        const { useEngineBridgeStore } = await import('/src/store/useEngineBridgeStore.ts');
        const { useProjectStore } = await import('/src/store/storeBootstrap.ts');
        const engine = useEngineBridgeStore.getState().engine;
        const context = document.createElement('canvas').getContext('2d');
        context.font = `40px ${family}`;
        return { count: [...document.fonts].filter(face => face.family === family).length,
            generation: useProjectStore.getState().projectGeneration, path: engine?.stateManager.getPersistent('projectPath'), width: context.measureText('\uea60\uea60\uea60').width };
    }, family);
}

async function ready(page, root) {
    await dock(page, 'preview');
    await expect.poll(() => state(page)).toMatchObject({ count: 1, path: root });
    return state(page);
}

async function fontMetrics(page) {
    return page.evaluate(async family => {
        const source = await (await fetch('/src/services/previewFont.ts')).text();
        const dependency = source.match(/import \{ CanvasTextMetrics \} from ["']([^"']+)["']/)[1];
        const { CanvasTextMetrics, TextStyle } = await import(dependency);
        const font = new TextStyle({ fontFamily: family, fontSize: 40 })._fontString;
        const next = CanvasTextMetrics.measureFont(font);
        const changed = next !== globalThis.__priorFontMetrics;
        globalThis.__priorFontMetrics = next;
        return changed;
    }, family);
}

async function delay(page, root, phase) {
    await page.evaluate(async ({ family, root, phase }) => {
        const { browserFsAdapter: fs } = await import('/src/services/fs/browserFsAdapter.ts');
        let started;
        const startedPromise = new Promise(resolve => { started = resolve; });
        let release;
        let reject;
        const pending = new Promise((resolve, fail) => { release = resolve; reject = fail; });
        globalThis.__fontDelay = { pending, reject, release, startedPromise };
        if (phase === 'load') {
            const original = FontFace.prototype.load;
            FontFace.prototype.load = async function () {
                if (this.family !== family) return original.call(this);
                FontFace.prototype.load = original;
                const loading = original.call(this);
                started();
                await pending;
                return loading;
            };
        } else {
            const method = phase === 'config' ? 'readTextFile' : 'readBinaryFile';
            const suffix = phase === 'config' ? '/engine.config.json' : '/fonts/shared.ttf';
            const original = fs[method];
            fs[method] = async function (path, ...args) {
                if (path !== root + suffix) return original.call(this, path, ...args);
                fs[method] = original;
                const result = await original.call(this, path, ...args);
                started();
                await pending;
                return result;
            };
        }
    }, { family, phase, root });
}

test.describe('preview font project ownership', () => {
    test.beforeEach(async ({ page }) => {
        page.__fontErrors = [];
        page.on('pageerror', error => page.__fontErrors.push(error.message));
        await setup(page);
    });
    test.afterEach(async ({ page }) => { expect(page.__fontErrors).toEqual([]); });

    for (const name of ['classic-vn-starter', 'example-game']) {
        test(`${name} uses each project's bytes and releases faces on reload and unmount`, async ({ page }) => {
            const { first, second } = await projects(page, name);
            await openFixture(page, first);
            const a = await ready(page, first);
            await fontMetrics(page);
            await openFixture(page, second);
            const b = await ready(page, second);
            expect(b.width).toBeCloseTo(a.width * 2, 1);
            expect(await fontMetrics(page)).toBe(true);
            await openFixture(page, first);
            expect((await ready(page, first)).width).toBeCloseTo(a.width, 1);
            await page.evaluate(async family => {
                globalThis.__priorFontFace = [...document.fonts].find(face => face.family === family);
                (await import('/src/store/storeBootstrap.ts')).useProjectStore.setState(state => ({ treeRevision: state.treeRevision + 1 }));
            }, family);
            await expect.poll(() => page.evaluate(() => document.fonts.has(globalThis.__priorFontFace))).toBe(false);
            expect((await ready(page, first)).width).toBeCloseTo(a.width, 1);
            await page.evaluate(async () => (await import('/src/store/storeBootstrap.ts')).useProjectStore.setState({ manifest: undefined }));
            await expect.poll(() => state(page)).toMatchObject({ count: 0 });
            expect(await fontMetrics(page)).toBe(true);
        });

        for (const [phase, outcome] of [['resolve', 'success'], ['resolve', 'failure'], ['load', 'success'], ['load', 'failure'], ['config', 'success']]) {
            test(`${name} discards stale ${phase} ${outcome} across A to B to A`, async ({ page }) => {
                const { first, second } = await projects(page, name);
                await delay(page, first, phase);
                await openFixture(page, first);
                await dock(page, 'preview');
                await page.evaluate(() => globalThis.__fontDelay.startedPromise);
                await openFixture(page, second);
                const b = await ready(page, second);
                await openFixture(page, first);
                const a = await ready(page, first);
                expect(b.width).toBeCloseTo(a.width * 2, 1);
                await page.evaluate(outcome => {
                    if (outcome === 'success') globalThis.__fontDelay.release();
                    else globalThis.__fontDelay.reject(new Error('stale injected font failure'));
                }, outcome);
                await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
                expect(await state(page)).toEqual(a);
            });
        }
    }
});
