import { chromium, expect, test as baseTest } from '@playwright/test';
import { mkdtemp } from 'node:fs/promises';
import path from 'node:path';

const test = baseTest.extend({
    context: async ({ baseURL }, use, testInfo) => {
        const profile = await mkdtemp(path.join(process.cwd(), 'temp', 'plugin-lifecycle-'));
        const context = await chromium.launchPersistentContext(profile, {
            args: ['--disable-audio-output'], baseURL, colorScheme: 'dark', headless: true,
            hasTouch: testInfo.project.use.hasTouch, isMobile: testInfo.project.use.isMobile,
            reducedMotion: 'reduce', viewport: testInfo.project.use.viewport,
        });
        try { await use(context); } finally { await context.close(); }
    },
});

test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
        globalThis.showDirectoryPicker = () => Promise.reject(new DOMException('No fixture selected', 'AbortError'));
    });
    await page.route('https://fonts.googleapis.com/**', route => route.fulfill({ body: '', contentType: 'text/css' }));
    await page.goto('/');
});

async function installFixture(page, options = {}) {
    return page.evaluate(async options => {
        const { browserFsAdapter: fs } = await import('/src/services/fs/browserFsAdapter.ts');
        const { createEditorPluginInstallPlan, createEditorPluginSourceRecord, inspectEditorPluginManifestText } = await import('/src/plugins/pluginManifestInspection.ts');
        const { installEditorPluginSourceRecord } = await import('/src/plugins/pluginSourceInstaller.ts');
        const registryModule = await (await fetch('/src/plugins/commandPlugins.tsx')).text();
        const schemaUrl = registryModule.match(/import\s*\{\s*SchemaRegistry\s*\}\s*from\s*["']([^"']+)/)[1];
        globalThis.lifecycleSchemas = await import(schemaUrl);
        const handle = await (await navigator.storage.getDirectory()).getDirectoryHandle(`lifecycle-${crypto.randomUUID()}`, { create: true });
        const root = fs.mountDirectory(handle);
        const source = `${root}/source`, installed = `${root}/installed`;
        await fs.mkdir(source, true);
        await fs.mkdir(installed, true);
        const manifest = { capabilities: ['commands'], entry: 'index.js', id: 'lifecycle.tools', name: 'Lifecycle Tools', pluginApiVersion: 1, version: '1.0.0' };
        const code = `import { z } from '${location.origin}/@id/zod';
            import React from '${location.origin}/node_modules/.vite/deps/react.js';
            const { createElement } = React;
            globalThis.lifecycleEvaluations = (globalThis.lifecycleEvaluations ?? 0) + 1;
            export default {
                manifest: ${JSON.stringify(manifest)},
                commands: [{ type: 'lifecycle.marker', label: 'Lifecycle Marker v1', schema: z.object({ type: z.literal('lifecycle.marker'), value: z.string() }).passthrough(), Inspector: () => createElement('div', { 'data-testid': 'lifecycle-inspector' }, 'Lifecycle Inspector') }],
                activate(api) {
                    globalThis.lifecycleActivations = (globalThis.lifecycleActivations ?? 0) + 1;
                    globalThis.lifecycleRetainedApi = api;
                    api.registerCommandPlugin({ type: 'lifecycle.dynamic', label: 'Lifecycle Dynamic' });
                    ${options.failActivation ? "throw Error('Activation fixture failure');" : ''}
                    return () => {
                        globalThis.lifecycleCleanups = (globalThis.lifecycleCleanups ?? 0) + 1;
                        ${options.throwCleanup ? "throw Error('Cleanup fixture failure');" : ''}
                    };
                },
                deactivate() {
                    globalThis.lifecycleDeactivations = (globalThis.lifecycleDeactivations ?? 0) + 1;
                    ${options.throwDeactivate ? "throw Error('Deactivate fixture failure');" : ''}
                }
            };`;
        const manifestPath = `${source}/plugin.json`;
        await fs.writeTextFile(manifestPath, JSON.stringify(manifest));
        await fs.writeTextFile(`${source}/index.js`, code);
        const inspection = inspectEditorPluginManifestText(JSON.stringify(manifest), manifestPath);
        const record = createEditorPluginSourceRecord(createEditorPluginInstallPlan(inspection)).record;
        const result = await installEditorPluginSourceRecord(record, { installRoot: installed });
        const installedHandle = await handle.getDirectoryHandle('installed');
        globalThis.showDirectoryPicker = async () => installedHandle;
        globalThis.lifecycleFixture = { code, installed, record, result, source };
        return { code, installed, result, source, evaluations: globalThis.lifecycleEvaluations ?? 0 };
    }, options);
}

async function openPlugins(page) {
    await page.evaluate(async () => (await import('/src/store/useEditorStore.ts')).useEditorStore.getState().openSettingsModal());
    const settings = page.getByRole('dialog', { name: 'Settings' });
    await settings.getByRole('button', { name: 'Plugins', exact: true }).click();
    return settings;
}

async function loadFolder(settings, loaded, blocked) {
    await settings.getByRole('button', { name: 'Load Folder...', exact: true }).click();
    await expect(settings.getByRole('button', { name: 'Load Folder...', exact: true })).toBeEnabled();
    const status = settings.getByRole('status').filter({ hasText: `loaded ${loaded}` });
    await expect(status).toContainText(`blocked ${blocked}`);
}

async function registryState(page) {
    return page.evaluate(async () => {
        const { getAllPlugins, getPlugin, getRegisteredEditorPlugins } = await import('/src/plugins/commandPlugins.tsx');
        const { SchemaRegistry } = globalThis.lifecycleSchemas;
        const { browserFsAdapter: fs } = await import('/src/services/fs/browserFsAdapter.ts');
        const saved = JSON.parse(await fs.readTextFile(`${globalThis.lifecycleFixture.source}/saved-node.json`));
        let lateError;
        if (!getRegisteredEditorPlugins().find(plugin => plugin.manifest.id === 'lifecycle.tools')?.active) {
            try { globalThis.lifecycleRetainedApi.registerCommandPlugin({ type: 'lifecycle.late', label: 'Late' }); }
            catch (error) { lateError = error.message; }
        }
        return {
            active: getRegisteredEditorPlugins().find(plugin => plugin.manifest.id === 'lifecycle.tools')?.active ?? false,
            activations: globalThis.lifecycleActivations ?? 0, evaluations: globalThis.lifecycleEvaluations ?? 0,
            cleanups: globalThis.lifecycleCleanups ?? 0, deactivations: globalThis.lifecycleDeactivations ?? 0,
            commandTypes: getAllPlugins().map(plugin => plugin.type), label: getPlugin('lifecycle.marker').label,
            hasSchema: !!SchemaRegistry.get('lifecycle.marker'), parsed: SchemaRegistry.getCommandSchema().parse(saved), lateError,
            savedBytes: await fs.readTextFile(`${globalThis.lifecycleFixture.source}/saved-node.json`),
        };
    });
}

test('Settings removes owned commands, preserves saved unknown fields and reloads newly validated bytes', async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const sample = await installFixture(page);
    expect(sample.evaluations).toBe(0);
    const saved = { type: 'lifecycle.marker', value: 'retained', nested: { custom: [1, 2] } };
    await page.evaluate(async saved => {
        const { browserFsAdapter: fs } = await import('/src/services/fs/browserFsAdapter.ts');
        const { registerCommandPlugin, registerEditorPlugin } = await import('/src/plugins/commandPlugins.tsx');
        await fs.writeTextFile(`${globalThis.lifecycleFixture.source}/saved-node.json`, JSON.stringify(saved));
        registerCommandPlugin({ type: 'unowned.marker', label: 'Unowned Marker' });
        registerEditorPlugin({ manifest: { id: 'other.tools', name: 'Other Tools', version: '1.0.0' }, commands: [{ type: 'other.marker', label: 'Other Marker' }] });
    }, saved);
    const settings = await openPlugins(page);
    await loadFolder(settings, 1, 0);
    const plugin = settings.locator('article').filter({ hasText: 'Lifecycle Tools' });
    await expect(plugin).toContainText('Active');
    const active = await registryState(page);
    expect(active.hasSchema).toBe(true);
    expect(active.commandTypes).toEqual(expect.arrayContaining(['lifecycle.marker', 'lifecycle.dynamic', 'dialogue', 'other.marker', 'unowned.marker']));
    await loadFolder(settings, 0, 1);
    expect((await registryState(page)).evaluations).toBe(1);
    await settings.getByRole('button', { name: 'Deactivate plugin Lifecycle Tools' }).click();
    await expect(plugin).toContainText('Inactive');
    const inactive = await registryState(page);
    expect(inactive).toMatchObject({ active: false, evaluations: 1, activations: 1, cleanups: 1, deactivations: 1, hasSchema: false, parsed: saved });
    expect(inactive.commandTypes).toEqual(expect.arrayContaining(['dialogue', 'other.marker', 'unowned.marker']));
    for (const type of ['lifecycle.marker', 'lifecycle.dynamic', 'lifecycle.late']) expect(inactive.commandTypes).not.toContain(type);
    expect(inactive.label).not.toBe('Lifecycle Marker v1');
    expect(inactive.lateError).toBeTruthy();
    expect(inactive.savedBytes).toBe(JSON.stringify(saved));
    await page.evaluate(async () => {
        const { browserFsAdapter: fs } = await import('/src/services/fs/browserFsAdapter.ts');
        const { installEditorPluginSourceRecord } = await import('/src/plugins/pluginSourceInstaller.ts');
        const fixture = globalThis.lifecycleFixture;
        await fs.writeTextFile(`${fixture.source}/index.js`, fixture.code.replace('Lifecycle Marker v1', 'Lifecycle Marker v2'));
        await installEditorPluginSourceRecord(fixture.record, { installRoot: fixture.installed, overwrite: true });
    });
    await loadFolder(settings, 1, 0);
    await expect(plugin).toContainText('Active');
    expect(await registryState(page)).toMatchObject({ active: true, evaluations: 2, activations: 2, cleanups: 1, deactivations: 1, hasSchema: true, label: 'Lifecycle Marker v2' });
    expect(errors).toEqual([]);
});

test('concurrent default-loader attempts evaluate and activate an installed package once', async ({ page }) => {
    const sample = await installFixture(page);
    const result = await page.evaluate(async installed => {
        const { loadInstalledEditorPluginPackages } = await import('/src/plugins/pluginPackageLoader.ts');
        const { registerEditorPlugin } = await import('/src/plugins/commandPlugins.tsx');
        const results = await Promise.all(Array.from({ length: 3 }, () => loadInstalledEditorPluginPackages(installed, registerEditorPlugin)));
        return { loaded: results.reduce((sum, result) => sum + result.registered.length, 0), blocked: results.reduce((sum, result) => sum + result.rejected.length, 0), evaluations: globalThis.lifecycleEvaluations, activations: globalThis.lifecycleActivations };
    }, sample.installed);
    expect(result).toEqual({ loaded: 1, blocked: 2, evaluations: 1, activations: 1 });
});

test('Settings stays current when both teardown hooks throw and never runs either twice', async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await installFixture(page, { throwCleanup: true, throwDeactivate: true });
    const settings = await openPlugins(page);
    await loadFolder(settings, 1, 0);
    await settings.getByRole('button', { name: 'Deactivate plugin Lifecycle Tools' }).click();
    await expect(settings.locator('article').filter({ hasText: 'Lifecycle Tools' })).toContainText('Inactive');
    const result = await page.evaluate(async () => {
        const { deactivateEditorPlugin, getAllPlugins } = await import('/src/plugins/commandPlugins.tsx');
        return { again: deactivateEditorPlugin('lifecycle.tools'), cleanups: globalThis.lifecycleCleanups, deactivations: globalThis.lifecycleDeactivations, types: getAllPlugins().map(plugin => plugin.type) };
    });
    expect(result).toMatchObject({ again: false, cleanups: 1, deactivations: 1 });
    expect(result.types).not.toContain('lifecycle.marker');
    expect(result.types).not.toContain('lifecycle.dynamic');
    expect(errors).toEqual([]);
});

test('failed bundled activation rolls back declared and scoped commands and permits a corrected retry', async ({ page }) => {
    await installFixture(page, { failActivation: true });
    const settings = await openPlugins(page);
    await loadFolder(settings, 0, 1);
    await expect(settings).toContainText('Activation fixture failure');
    const failed = await page.evaluate(async () => {
        const { getAllPlugins } = await import('/src/plugins/commandPlugins.tsx');
        const { SchemaRegistry } = globalThis.lifecycleSchemas;
        let lateError;
        try { globalThis.lifecycleRetainedApi.registerCommandPlugin({ type: 'lifecycle.late' }); }
        catch (error) { lateError = error.message; }
        return { types: getAllPlugins().map(plugin => plugin.type), schema: !!SchemaRegistry.get('lifecycle.marker'), lateError };
    });
    for (const type of ['lifecycle.marker', 'lifecycle.dynamic', 'lifecycle.late']) expect(failed.types).not.toContain(type);
    expect(failed.schema).toBe(false);
    expect(failed.lateError).toBeTruthy();
    await page.evaluate(async () => {
        const { browserFsAdapter: fs } = await import('/src/services/fs/browserFsAdapter.ts');
        const { installEditorPluginSourceRecord } = await import('/src/plugins/pluginSourceInstaller.ts');
        const fixture = globalThis.lifecycleFixture;
        await fs.writeTextFile(`${fixture.source}/index.js`, fixture.code.replace("throw Error('Activation fixture failure');", ''));
        await installEditorPluginSourceRecord(fixture.record, { installRoot: fixture.installed, overwrite: true });
    });
    await loadFolder(settings, 1, 0);
    expect(await page.evaluate(() => ({ evaluations: globalThis.lifecycleEvaluations, activations: globalThis.lifecycleActivations }))).toEqual({ evaluations: 2, activations: 2 });
});

test('mounted command menu and inspector update on load, deactivation and reactivation', async ({ page }) => {
    await installFixture(page);
    const saved = { type: 'lifecycle.marker', value: 'retained', nested: { custom: [1, 2] } };
    await page.evaluate(async saved => {
        const harness = globalThis.__ZERITH_EDITOR_VISUAL_SMOKE__;
        await harness.openProjectFixture({
            entryPath: 'scenes/intro.json', rootName: 'lifecycle-project', selectedPath: [0],
            files: {
                'game.json': JSON.stringify({ $schema: 'zerith/manifest', schemaVersion: 2, title: 'Lifecycle Project', startScene: 'intro', scenes: { intro: '/scenes/intro.json' } }),
                'scenes/intro.json': JSON.stringify({ $schema: 'zerith/scene', schemaVersion: 2, commands: [saved] }),
            },
        });
        harness.selectDockPanel('inspector');
    }, saved);
    const fallback = page.getByText('No schema-derived scalar fields for "lifecycle.marker".', { exact: true });
    await expect(fallback).toBeVisible();
    const settings = await openPlugins(page);
    await loadFolder(settings, 1, 0);
    await page.evaluate(() => globalThis.__ZERITH_EDITOR_VISUAL_SMOKE__.closeSettingsModal());
    await expect(page.getByTestId('lifecycle-inspector')).toBeVisible();
    await page.getByRole('button', { name: '+ Add Command', exact: true }).click();
    await page.getByPlaceholder('Search commands...').fill('lifecycle.marker');
    await expect(page.getByRole('button', { name: /Lifecycle Marker v1 \(lifecycle.marker\)/ })).toBeVisible();
    await page.keyboard.press('Escape');

    await openPlugins(page);
    await settings.getByRole('button', { name: 'Deactivate plugin Lifecycle Tools' }).click();
    await page.evaluate(() => globalThis.__ZERITH_EDITOR_VISUAL_SMOKE__.closeSettingsModal());
    await expect(page.getByTestId('lifecycle-inspector')).toHaveCount(0);
    await expect(fallback).toBeVisible();
    await page.getByRole('button', { name: '+ Add Command', exact: true }).click();
    await page.getByPlaceholder('Search commands...').fill('lifecycle');
    await expect(page.getByText('No commands found.', { exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    expect(await page.evaluate(() => globalThis.__ZERITH_EDITOR_VISUAL_SMOKE__.readEditingState().script)).toEqual([saved]);
    expect(JSON.parse(await page.evaluate(() => globalThis.__ZERITH_EDITOR_VISUAL_SMOKE__.readFixtureFile('scenes/intro.json'))).commands).toEqual([saved]);

    await openPlugins(page);
    await loadFolder(settings, 1, 0);
    await page.evaluate(() => globalThis.__ZERITH_EDITOR_VISUAL_SMOKE__.closeSettingsModal());
    await expect(page.getByTestId('lifecycle-inspector')).toBeVisible();
    expect(await page.evaluate(() => ({ evaluations: globalThis.lifecycleEvaluations, activations: globalThis.lifecycleActivations }))).toEqual({ evaluations: 2, activations: 2 });
});
