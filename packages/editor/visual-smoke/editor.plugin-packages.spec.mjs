import { chromium, expect, test as baseTest } from '@playwright/test';
import { mkdtemp } from 'node:fs/promises';
import path from 'node:path';

const test = baseTest.extend({
    context: async ({ baseURL }, use, testInfo) => {
        const profile = await mkdtemp(path.join(process.cwd(), 'temp', 'plugin-package-'));
        const context = await chromium.launchPersistentContext(profile, {
            args: ['--disable-audio-output'], baseURL, colorScheme: 'dark', headless: true,
            hasTouch: testInfo.project.use.hasTouch, isMobile: testInfo.project.use.isMobile,
            reducedMotion: 'reduce', viewport: testInfo.project.use.viewport,
        });
        try { await use(context); } finally { await context.close(); }
    },
});

test.beforeEach(async ({ page }) => {
    await page.route('https://fonts.googleapis.com/**', route => route.fulfill({ body: '', contentType: 'text/css' }));
    await page.goto('/');
});

async function installSample(page, includeSourceRecord) {
    return page.evaluate(async includeSourceRecord => {
        const { browserFsAdapter: fs } = await import('/src/services/fs/browserFsAdapter.ts');
        const { createEditorPluginInstallPlan, createEditorPluginSourceRecord, inspectEditorPluginManifestText, serializeEditorPluginSourceRecord } = await import('/src/plugins/pluginManifestInspection.ts');
        const { installEditorPluginSourceRecord } = await import('/src/plugins/pluginSourceInstaller.ts');
        const handle = await (await navigator.storage.getDirectory()).getDirectoryHandle(`plugins-${crypto.randomUUID()}`, { create: true });
        const root = fs.mountDirectory(handle);
        const source = `${root}/source`;
        const installed = `${root}/installed`;
        await fs.mkdir(`${source}/dist`, true);
        await fs.mkdir(installed, true);
        const manifest = { capabilities: ['commands'], entry: 'dist/index.js', id: 'sample.tools', name: 'Sample Tools', pluginApiVersion: 1, version: '1.0.0' };
        const code = `globalThis.samplePluginEvaluations = (globalThis.samplePluginEvaluations ?? 0) + 1;
            export default {
                manifest: ${JSON.stringify(manifest)},
                commands: [{ type: 'sample.marker', label: 'Sample Marker' }],
                activate() { globalThis.samplePluginActivations = (globalThis.samplePluginActivations ?? 0) + 1; return () => { globalThis.samplePluginCleanups = (globalThis.samplePluginCleanups ?? 0) + 1; }; },
                deactivate() { globalThis.samplePluginDeactivations = (globalThis.samplePluginDeactivations ?? 0) + 1; }
            };`;
        const manifestPath = `${source}/plugin.json`;
        await fs.writeTextFile(manifestPath, JSON.stringify(manifest));
        await fs.writeTextFile(`${source}/dist/index.js`, code);
        const inspection = inspectEditorPluginManifestText(JSON.stringify(manifest), manifestPath);
        const record = createEditorPluginSourceRecord(createEditorPluginInstallPlan(inspection)).record;
        const sourceRecordPath = `${source}/zerith.editorPluginSource.json`;
        const sourceText = serializeEditorPluginSourceRecord(record);
        if (includeSourceRecord) await fs.writeTextFile(sourceRecordPath, sourceText);
        const result = await installEditorPluginSourceRecord(record, { installRoot: installed });
        return {
            installed, result, code, source,
            evaluationCount: globalThis.samplePluginEvaluations ?? 0,
            retainedSource: await fs.readTextFile(`${source}/dist/index.js`) === code
                && (!includeSourceRecord || await fs.readTextFile(sourceRecordPath) === sourceText),
        };
    }, includeSourceRecord);
}

test('installs a package containing its source record without invalidating its hashes', async ({ page }) => {
    const sample = await installSample(page, true);
    expect(sample.evaluationCount).toBe(0);
    expect(sample.retainedSource).toBe(true);
    const verification = await page.evaluate(async recordPath => {
        const { browserFsAdapter: fs } = await import('/src/services/fs/browserFsAdapter.ts');
        const { inspectEditorPluginSourceRecordText } = await import('/src/plugins/pluginManifestInspection.ts');
        const { verifyEditorPluginPackageIntegrity } = await import('/src/plugins/pluginPackageIntegrity.ts');
        const inspection = inspectEditorPluginSourceRecordText(await fs.readTextFile(recordPath), recordPath);
        if (inspection.status !== 'ready') throw Error(inspection.reason);
        return verifyEditorPluginPackageIntegrity(inspection.record);
    }, sample.result.recordPath);
    expect(verification).toEqual({ checkedFiles: 2, status: 'verified' });
});

test('explicitly loads and deactivates an installed bundled module and blocks tampering', async ({ page }) => {
    const sample = await installSample(page, false);
    expect(sample.evaluationCount).toBe(0);
    expect(sample.retainedSource).toBe(true);
    const loaded = await page.evaluate(async installed => {
        const { loadInstalledEditorPluginPackages } = await import('/src/plugins/pluginPackageLoader.ts');
        const { getPlugin, registerEditorPlugin } = await import('/src/plugins/commandPlugins.tsx');
        const loaded = await loadInstalledEditorPluginPackages(installed, registerEditorPlugin);
        if (loaded.rejected.length) return { rejected: loaded.rejected };
        return { registered: loaded.registered.map(plugin => plugin.manifest.id), label: getPlugin('sample.marker').label };
    }, sample.installed);
    expect(loaded).toEqual({ registered: ['sample.tools'], label: 'Sample Marker' });
    await page.evaluate(async () => (await import('/src/store/useEditorStore.ts')).useEditorStore.getState().openSettingsModal());
    const settings = page.getByRole('dialog', { name: 'Settings' });
    await settings.getByRole('button', { name: 'Plugins', exact: true }).click();
    const plugin = settings.locator('article').filter({ hasText: 'Sample Tools' });
    await expect(plugin).toContainText('Active');
    await settings.getByRole('button', { name: 'Deactivate plugin Sample Tools' }).click();
    await expect(plugin).toContainText('Inactive');
    const result = await page.evaluate(async ({ installed, result, code }) => {
        const { loadInstalledEditorPluginPackages } = await import('/src/plugins/pluginPackageLoader.ts');
        const { getRegisteredEditorPlugins, registerEditorPlugin } = await import('/src/plugins/commandPlugins.tsx');
        const { browserFsAdapter: fs } = await import('/src/services/fs/browserFsAdapter.ts');
        await fs.writeTextFile(`${result.targetPath}/dist/index.js`, `${code}\nglobalThis.tamperedPluginRan = true;`);
        const tampered = await loadInstalledEditorPluginPackages(installed, registerEditorPlugin);
        return {
            active: getRegisteredEditorPlugins().find(plugin => plugin.manifest.id === 'sample.tools').active,
            evaluations: globalThis.samplePluginEvaluations, activations: globalThis.samplePluginActivations,
            cleanups: globalThis.samplePluginCleanups, deactivations: globalThis.samplePluginDeactivations,
            tamperedRegistrations: tampered.registered.length, tamperedRejections: tampered.rejected.length,
            tamperedRan: globalThis.tamperedPluginRan ?? false,
        };
    }, sample);
    expect(result).toEqual({
        active: false,
        evaluations: 1, activations: 1, cleanups: 1, deactivations: 1,
        tamperedRegistrations: 0, tamperedRejections: 1, tamperedRan: false,
    });
});

test('releases module URLs after syntax and package-relative import failures', async ({ page }) => {
    const result = await page.evaluate(async () => {
        const { loadEditorPluginModule } = await import('/src/plugins/pluginModuleLoader.ts');
        const create = URL.createObjectURL;
        const revoke = URL.revokeObjectURL;
        const created = [], revoked = [], failures = [];
        URL.createObjectURL = blob => { const url = create(blob); created.push(url); return url; };
        URL.revokeObjectURL = url => { revoked.push(url); revoke(url); };
        try {
            for (const code of ['export default {', "import './helper.js'; globalThis.relativePluginRan = true;"]) {
                try { await loadEditorPluginModule('/sample/index.js', new TextEncoder().encode(code)); }
                catch (error) { failures.push(error.message); }
            }
            await loadEditorPluginModule('/sample/valid.js', new TextEncoder().encode('export default {};'));
            return { failures, created, revoked, relativeRan: globalThis.relativePluginRan ?? false };
        } finally { URL.createObjectURL = create; URL.revokeObjectURL = revoke; }
    });
    expect(result.failures).toHaveLength(2);
    for (const failure of result.failures) expect(failure).toContain("Could not load plugin entry '/sample/index.js'");
    expect(result.created).toHaveLength(3);
    expect(result.revoked).toEqual(result.created);
    expect(result.relativeRan).toBe(false);
});
