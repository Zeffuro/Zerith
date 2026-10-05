import { expect, test } from '@playwright/test';

async function setup(page) {
    await page.route('**/plugin-ownership.html', route => route.fulfill({ contentType: 'text/html', body: '<html><body><canvas></canvas><button id="run">Run marker</button><output role="status" id="marker">Ready</output></body></html>' }));
    await page.route('**/ownership-plugin-game.json', route => route.fulfill({ json: { schemaVersion: 2, id: 'plugin-ownership-check', title: 'Plugin ownership', startScene: 'intro', scenes: { intro: { schemaVersion: 2, commands: [] } } } }));
    await page.goto('http://127.0.0.1:1423/plugin-ownership.html');
    await page.evaluate(async () => {
        const { bootstrapPlayer } = await import('/src/runtime/bootstrapPlayer.ts');
        const engine = await bootstrapPlayer({ canvas: document.querySelector('canvas'), manifestUrl: '/ownership-plugin-game.json',
            configUrl: false, compiledContentUrl: false, prefetchCompiledAssets: false, preloadAssets: false, defaultBlipUrl: null,
            config: { display: { width: 320, height: 180 }, player: {} }, shell: () => ({ start: async () => {}, dispose() {} }),
        });
        window.pluginEngine = engine;
        window.pluginRuntimeErrors = [];
        engine.logger.error = message => { window.pluginRuntimeErrors.push(message); };
        window.pluginCounts = { activations: 0, cleanups: 0, deactivations: 0, destroys: {} };
        window.makePluginManifest = id => ({ id, name: id, version: '1.0.0', capabilities: ['commands'] });
        window.makePluginHandler = id => {
            let destroyed = false;
            return { type: 'ownership.marker', execute() {
                if (destroyed) throw new Error(`Destroyed ${id} executed`);
                document.querySelector('#marker').textContent = id;
            }, destroy() {
                if (destroyed) throw new Error(`Destroyed ${id} twice`);
                destroyed = true;
                window.pluginCounts.destroys[id] = (window.pluginCounts.destroys[id] ?? 0) + 1;
            } };
        };
        engine.registerHandler(window.makePluginHandler('default'));
        document.querySelector('#run').onclick = () => { void engine.runCommand({ type: 'ownership.marker' }); };
    });
}

for (const order of ['AB', 'BA']) {
    test(`real player dispatch restores live handlers after ${order} unload`, async ({ page }) => {
        const errors = [];
        page.on('pageerror', error => errors.push(String(error)));
        await setup(page);
        await page.evaluate(async () => {
            for (const id of ['A', 'B']) await window.pluginEngine.registerPlugin({ manifest: window.makePluginManifest(id), activate: context => {
                context.registerHandler(window.makePluginHandler(id));
                return () => { window.pluginCounts.cleanups += 1; };
            } });
        });
        await page.getByRole('button', { name: 'Run marker' }).click();
        await expect(page.locator('#marker')).toHaveText('B');
        await page.evaluate(id => window.pluginEngine.deactivatePlugin(id), order[0]);
        await page.getByRole('button', { name: 'Run marker' }).click();
        await expect(page.locator('#marker')).toHaveText(order === 'AB' ? 'B' : 'A');
        await page.evaluate(id => window.pluginEngine.deactivatePlugin(id), order[1]);
        await page.getByRole('button', { name: 'Run marker' }).click();
        await expect(page.locator('#marker')).toHaveText('default');
        const result = await page.evaluate(() => {
            window.pluginEngine.destroy();
            window.pluginEngine.destroy();
            return { counts: window.pluginCounts, registered: window.pluginEngine.getRegisteredPlugins(), runtimeErrors: window.pluginRuntimeErrors };
        });
        expect(result.counts.destroys).toEqual({ A: 1, B: 1, default: 1 });
        expect(result.counts.cleanups).toBe(2);
        expect(result.registered).toEqual([]);
        expect(result.runtimeErrors).toEqual([]);
        expect(errors).toEqual([]);
    });
}

for (const operation of ['deactivate', 'destroy']) {
    test(`${operation} cancels pending runtime activation without leaking ownership`, async ({ page }) => {
        const errors = [];
        page.on('pageerror', error => errors.push(String(error)));
        await setup(page);
        const duplicate = await page.evaluate(async () => {
            const engine = window.pluginEngine;
            const activate = context => {
                window.pluginCounts.activations += 1;
                window.retainedPluginContext = context;
                context.registerHandler(window.makePluginHandler('pending'));
                return new Promise(resolve => { window.finishPluginActivation = () => resolve(() => { window.pluginCounts.cleanups += 1; }); });
            };
            window.pendingPlugin = engine.registerPlugin({ manifest: window.makePluginManifest(' pending '), activate,
                deactivate() { window.pluginCounts.deactivations += 1; } }).then(() => 'registered', error => String(error));
            try { await engine.registerPlugin({ manifest: window.makePluginManifest('pending'), activate }); return 'duplicate accepted'; }
            catch (error) { return String(error); }
        });
        expect(duplicate).toContain('already registered');
        const result = await page.evaluate(async operation => {
            const engine = window.pluginEngine;
            if (operation === 'destroy') engine.destroy();
            else await engine.deactivatePlugin('pending');
            let retainedError;
            try { window.retainedPluginContext.registerHandler(window.makePluginHandler('late')); }
            catch (error) { retainedError = String(error); }
            window.finishPluginActivation();
            const registration = await window.pendingPlugin;
            return { counts: window.pluginCounts, registration, retainedError, registered: engine.getRegisteredPlugins(), runtimeErrors: window.pluginRuntimeErrors,
                handlerIsDefault: engine.getHandler('ownership.marker')?.type === 'ownership.marker' };
        }, operation);
        expect(result.registration).toContain('cancelled');
        expect(result.retainedError).toContain('inactive');
        expect(result.counts).toMatchObject({ activations: 1, cleanups: 1, deactivations: 1, destroys: { pending: 1 } });
        expect(result.registered).toEqual([]);
        expect(result.runtimeErrors).toEqual([]);
        expect(result.handlerIsDefault).toBe(operation !== 'destroy');
        if (operation !== 'destroy') {
            await page.getByRole('button', { name: 'Run marker' }).click();
            await expect(page.locator('#marker')).toHaveText('default');
            await page.evaluate(() => window.pluginEngine.destroy());
        }
        expect(errors).toEqual([]);
    });
}
