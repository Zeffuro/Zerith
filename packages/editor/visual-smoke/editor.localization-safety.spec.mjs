import { expect } from '@playwright/test';
import path from 'node:path';
import { dock, mountFixture, openFixture, readFixture, replaceJson, setup, test } from './authoringHelpers.mjs';

const label = 'Translation safety:line';
const bundle = locale => ({ $schema: 'zerith/locale', locale, namespaces: { safety: { line: `${locale} original`, obsolete: 'Kept unused' } }, schemaVersion: 2 });

async function project(page, name, inline = false) {
    const files = await readFixture(name);
    replaceJson(files, 'engine.config.json', config => ({ ...config, audio: { ...config.audio, defaultBlipUrl: null } }));
    replaceJson(files, 'game.json', manifest => ({ ...manifest, localization: { defaultLocale: 'en', locales: inline ? { en: bundle('en'), fr: bundle('fr') } : { en: '/locales/en.json', fr: '/locales/fr.json' } }, scenes: { intro: '/scenes/intro.json' }, startScene: 'intro' }));
    files['scenes/intro.json'] = Buffer.from(JSON.stringify({ commands: [{ lineId: 'line', speaker: '', text: 'Source text', type: 'dialogue' }], localeNamespace: 'safety' })).toString('base64');
    for (const locale of ['en', 'fr']) files[`locales/${locale}.json`] = Buffer.from(JSON.stringify(bundle(locale), undefined, 2)).toString('base64');
    const root = await mountFixture(page, files);
    await openFixture(page, root);
    await show(page);
    await expect(page.locator('div').filter({ hasText: /^Source text$/ })).toBeVisible();
    return { files, root };
}
async function show(page) {
    await page.evaluate(async () => {
        const { openLocalizationWorkbenchTab } = await import('/src/services/localizationWorkbench.ts');
        openLocalizationWorkbenchTab();
    });
    await dock(page, 'editor');
    await expect(page.getByRole('textbox', { name: label, exact: true })).toBeEnabled();
}
async function select(page, locale) {
    await page.getByLabel('Localization locale', { exact: true }).selectOption(locale);
    await expect(page.getByRole('textbox', { name: label, exact: true })).toBeEnabled();
}
async function bytes(page, path) {
    return page.evaluate(async path => (await import('/src/services/fs/browserFsAdapter.ts')).browserFsAdapter.readTextFile(path), path);
}
async function setMonacoText(page, filePath, text) {
    await page.evaluate(async ({ filePath, text }) => {
        const source = await (await fetch('/src/services/monacoSetup.ts')).text();
        const dependency = source.match(/import \* as monaco from ["']([^"']+)["']/)[1];
        const api = await import(dependency);
        const model = api.editor.getModels().find(model => model.uri.path === filePath);
        if (!model) throw new Error('Expected mounted Monaco model');
        model.setValue(text);
    }, { filePath, text });
}
async function previewTranslation(page, root, locale, text) {
    await page.evaluate(async ({ root, locale }) => {
        const { openProjectEntry } = await import('/src/services/openProjectEntry/index.ts');
        const { useEditorStore } = await import('/src/store/useEditorStore.ts');
        await openProjectEntry(`${root}/scenes/intro.json`, 'intro.json');
        useEditorStore.getState().setPreviewLocale(locale);
    }, { root, locale });
    await dock(page, 'preview');
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await expect.poll(() => page.evaluate(async () => Boolean((await import('/src/store/useEngineBridgeStore.ts')).useEngineBridgeStore.getState().engine))).toBe(true);
    await page.evaluate(async () => (await import('/src/store/useEditorStore.ts')).useEditorStore.getState().triggerPlay());
    await expect.poll(() => page.evaluate(async () => (await import('/src/store/useEngineBridgeStore.ts')).useEngineBridgeStore.getState().engine?.stateManager.system.dialogue?.text)).toBe(text);
}
async function drafts(page) {
    return page.evaluate(async () => {
        const { useProjectStore } = await import('/src/store/storeBootstrap.ts');
        const { useWorkbenchStore } = await import('/src/store/useWorkbenchStore.ts');
        return { dirty: [...useProjectStore.getState().dirtyFiles], tabs: useWorkbenchStore.getState().tabs };
    });
}
async function saveAll(page) {
    return page.evaluate(async () => (await import('/src/store/storeBootstrap.ts')).useProjectStore.getState().saveAllDirtyFiles());
}

test.describe('localization draft and write safety', () => {
    test.beforeEach(async ({ page }) => {
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        page.__localizationErrors = errors;
        await setup(page);
    });
    test.afterEach(async ({ page }) => { expect(page.__localizationErrors).toEqual([]); });

    for (const name of ['classic-vn-starter', 'example-game']) {
        test(`${name} retains per-locale drafts on switching, panel reopening and project refresh`, async ({ page }, info) => {
            const { root } = await project(page, name);
            const input = page.getByRole('textbox', { name: label, exact: true });
            await input.fill('English draft');
            await select(page, 'fr');
            await input.fill('French draft');
            await select(page, 'en');
            await expect(input).toHaveValue('English draft');
            await page.evaluate(async () => {
                const { useWorkbenchStore } = await import('/src/store/useWorkbenchStore.ts');
                const tab = useWorkbenchStore.getState().tabs.find(tab => tab.kind === 'localization');
                useWorkbenchStore.getState().closeTab(tab.id);
            });
            await show(page);
            await expect(input).toHaveValue('English draft');
            await openFixture(page, root);
            await expect(input).toHaveValue('English draft');
            expect((await drafts(page)).dirty).toHaveLength(2);
            expect(JSON.parse(await bytes(page, `${root}/locales/en.json`)).namespaces.safety.line).toBe('en original');
            await page.screenshot({ path: path.join(info.outputDir, `${name}-localization-draft.png`), fullPage: true });
            expect(await saveAll(page)).toMatchObject({ failed: [], saved: [`${root}/locales/en.json`, `${root}/locales/fr.json`], skipped: [] });
            expect((await drafts(page)).dirty).toEqual([]);
            const cache = await page.evaluate(async () => (await import('/src/store/storeBootstrap.ts')).useProjectStore.getState().locales);
            expect(cache.en.namespaces.safety.line).toBe('English draft');
            expect(cache.fr.namespaces.safety.line).toBe('French draft');
            expect(JSON.parse(await bytes(page, `${root}/locales/fr.json`)).namespaces.safety.line).toBe('French draft');
            await previewTranslation(page, root, 'fr', 'French draft');
        });

        test(`${name} preserves failed writes and newer edits during a save`, async ({ page }) => {
            const { root } = await project(page, name);
            const input = page.getByRole('textbox', { name: label, exact: true });
            const original = await bytes(page, `${root}/locales/en.json`);
            await input.fill('First revision');
            await page.evaluate(async () => {
                const { browserFsAdapter: fs } = await import('/src/services/fs/browserFsAdapter.ts');
                const write = fs.writeTextFile;
                fs.writeTextFile = async (...args) => { fs.writeTextFile = write; throw new Error('Injected write failure'); };
            });
            await page.getByRole('button', { name: 'Save Locale', exact: true }).click();
            await expect(page.getByText('Injected write failure', { exact: true })).toBeVisible();
            expect(await bytes(page, `${root}/locales/en.json`)).toBe(original);
            await expect(input).toHaveValue('First revision');
            expect((await drafts(page)).dirty).toContain(`${root}/locales/en.json`);
            await page.evaluate(async () => {
                const { browserFsAdapter: fs } = await import('/src/services/fs/browserFsAdapter.ts');
                const write = fs.writeTextFile;
                fs.writeTextFile = async (...args) => {
                    globalThis.localizationWriting = true;
                    await new Promise(resolve => { globalThis.finishLocalizationWrite = resolve; });
                    fs.writeTextFile = write;
                    await write(...args);
                };
            });
            await page.getByRole('button', { name: 'Save Locale', exact: true }).click();
            await expect.poll(() => page.evaluate(() => globalThis.localizationWriting)).toBe(true);
            await input.fill('Newer revision');
            await page.evaluate(() => globalThis.finishLocalizationWrite());
            await expect(page.getByText('Earlier revision saved. Newer edits remain unsaved.', { exact: true })).toBeVisible();
            await expect(input).toHaveValue('Newer revision');
            expect(JSON.parse(await bytes(page, `${root}/locales/en.json`)).namespaces.safety.line).toBe('First revision');
            await page.getByRole('button', { name: 'Save Locale', exact: true }).click();
            await expect(page.getByText('Saved en.', { exact: true })).toBeVisible();
            expect(JSON.parse(await bytes(page, `${root}/locales/en.json`)).namespaces.safety.line).toBe('Newer revision');
        });

        test(`${name} restores both locales after restart and refuses external conflicts`, async ({ page }) => {
            const { root } = await project(page, name);
            const input = page.getByRole('textbox', { name: label, exact: true });
            await input.fill('Recovered English');
            await select(page, 'fr');
            await input.fill('Recovered French');
            await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('zerith-recovery-v1')).drafts[0].files.length)).toBe(2);
            await page.reload();
            const dialog = page.getByRole('dialog', { name: 'Recover unsaved work' });
            await dialog.getByRole('button', { name: 'Open project to review' }).click();
            await dialog.getByRole('button', { name: 'Restore edits' }).click();
            await show(page);
            await expect(input).toHaveValue('Recovered English');
            await select(page, 'fr');
            await expect(input).toHaveValue('Recovered French');
            await page.evaluate(async root => {
                const { browserFsAdapter: fs } = await import('/src/services/fs/browserFsAdapter.ts');
                const path = `${root}/locales/fr.json`;
                const data = JSON.parse(await fs.readTextFile(path));
                data.namespaces.safety.line = 'External translation';
                await fs.writeTextFile(path, JSON.stringify(data));
            }, root);
            await page.getByRole('button', { name: 'Save Locale', exact: true }).click();
            await expect(page.getByText('File changed on disk. Reopen it before saving.', { exact: true })).toBeVisible();
            await expect(input).toHaveValue('Recovered French');
            const result = await saveAll(page);
            expect(result.failed).toEqual([`${root}/locales/fr.json`]);
            expect(result.saved).toEqual([`${root}/locales/en.json`]);
            expect(JSON.parse(await bytes(page, `${root}/locales/fr.json`)).namespaces.safety.line).toBe('External translation');
            expect((await drafts(page)).dirty).toEqual([`${root}/locales/fr.json`]);
        });

        test(`${name} rejects filename collisions and retains a partially created file`, async ({ page }) => {
            const { root } = await project(page, name);
            const original = await bytes(page, `${root}/locales/en.json`);
            const newLocale = page.getByPlaceholder('New locale', { exact: true });
            await newLocale.fill('EN');
            await page.getByRole('button', { name: 'Add locale', exact: true }).click();
            await expect(page.getByText(/conflicts with existing locale en/)).toBeVisible();
            expect(await bytes(page, `${root}/locales/en.json`)).toBe(original);
            await page.evaluate(async root => {
                const { browserFsAdapter: fs } = await import('/src/services/fs/browserFsAdapter.ts');
                await fs.writeTextFile(`${root}/locales/de.json`, 'Unregistered original');
            }, root);
            await newLocale.fill('de');
            await page.getByRole('button', { name: 'Add locale', exact: true }).click();
            await expect(page.getByText(/Destination already exists/)).toBeVisible();
            expect(await bytes(page, `${root}/locales/de.json`)).toBe('Unregistered original');
            const before = await bytes(page, `${root}/game.json`);
            await page.evaluate(async () => {
                const { browserFsAdapter: fs } = await import('/src/services/fs/browserFsAdapter.ts');
                const write = fs.writeTextFile;
                fs.writeTextFile = async (...args) => {
                    if (args[0].endsWith('/game.json')) { fs.writeTextFile = write; throw new Error('Injected manifest failure'); }
                    return write(...args);
                };
            });
            await newLocale.fill('nl');
            await page.getByRole('button', { name: 'Add locale', exact: true }).click();
            await expect(page.getByText(/Locale file was created at .*nl.json.*Injected manifest failure/)).toBeVisible();
            expect(await bytes(page, `${root}/game.json`)).toBe(before);
            expect(JSON.parse(await bytes(page, `${root}/locales/nl.json`)).locale).toBe('nl');
            await newLocale.fill('it');
            await page.getByRole('button', { name: 'Add locale', exact: true }).click();
            await expect(page.getByLabel('Localization locale', { exact: true })).toHaveValue('it');
            expect(JSON.parse(await bytes(page, `${root}/game.json`)).localization.locales.it).toBe('/locales/it.json');
        });

        test(`${name} ignores a translator picker after switching away and back`, async ({ page }) => {
            await project(page, name);
            await page.evaluate(async () => {
                const { browserFsAdapter: fs } = await import('/src/services/fs/browserFsAdapter.ts');
                const pick = fs.pickBinaryFiles;
                fs.pickBinaryFiles = async () => {
                    globalThis.localizationPicking = true;
                    await new Promise(resolve => { globalThis.finishLocalizationPick = resolve; });
                    fs.pickBinaryFiles = pick;
                    return [{ name: 'en.translator.json', bytes: new TextEncoder().encode(JSON.stringify({ locale: 'en', entries: [{ namespace: 'safety', lineId: 'line', value: 'Late imported draft' }] })) }];
                };
            });
            await page.getByRole('button', { name: 'Import Drafts', exact: true }).click();
            await expect.poll(() => page.evaluate(() => globalThis.localizationPicking)).toBe(true);
            await select(page, 'fr');
            await select(page, 'en');
            await page.evaluate(() => globalThis.finishLocalizationPick());
            await expect(page.getByRole('textbox', { name: label, exact: true })).toHaveValue('en original');
            await expect.poll(async () => (await drafts(page)).dirty).toEqual([]);
        });


        test(`${name} shares actual raw typing with localization and preserves invalid recovery drafts`, async ({ page }) => {
            const { root } = await project(page, name);
            await page.getByRole('textbox', { name: label, exact: true }).fill('Panel first');
            const localePath = `${root}/locales/en.json`;
            const original = await bytes(page, localePath);
            await page.evaluate(async localePath => {
                const { openProjectEntry } = await import('/src/services/openProjectEntry/index.ts');
                await openProjectEntry(localePath, 'en.json', { forceView: 'json' });
            }, localePath);
            await dock(page, 'editor');
            const monaco = page.locator('.monaco-editor .native-edit-context, .monaco-editor textarea.inputarea:not([readonly])').first();
            await expect(page.locator('.monaco-editor').first()).toBeVisible();
            await expect(monaco).toBeAttached();
            await monaco.focus();
            await expect(monaco).toBeFocused();
            await page.keyboard.press('Control+a');
            await page.keyboard.type('not json');
            await expect.poll(async () => (await drafts(page)).tabs.find(tab => tab.path === localePath).textContent).toBe('not json');
            const invalid = await saveAll(page);
            expect(invalid.failed).toEqual([localePath]);
            expect(await bytes(page, localePath)).toBe(original);
            expect((await drafts(page)).dirty).toContain(localePath);
            await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('zerith-recovery-v1')).drafts[0].files.find(file => file.path.endsWith('/en.json')).text)).toBe('not json');
            await monaco.focus();
            await expect(monaco).toBeFocused();
            await page.keyboard.press('Control+a');
            const raw = bundle('en');
            raw.namespaces.safety.line = 'Actual raw edit';
            await setMonacoText(page, localePath, JSON.stringify(raw, undefined, 2));
            await expect.poll(async () => JSON.parse((await drafts(page)).tabs.find(tab => tab.path === localePath).textContent).namespaces.safety.line).toBe('Actual raw edit');
            await page.getByRole('button', { name: 'Apply', exact: true }).click();
            await show(page);
            await expect(page.getByRole('textbox', { name: label, exact: true })).toHaveValue('Actual raw edit');
            await page.getByRole('textbox', { name: label, exact: true }).fill('Panel after raw');
            await page.evaluate(async localePath => {
                const { openProjectEntry } = await import('/src/services/openProjectEntry/index.ts');
                await openProjectEntry(localePath, 'en.json', { forceView: 'json' });
            }, localePath);
            await monaco.focus();
            await expect(monaco).toBeFocused();
            await page.keyboard.press('Control+s');
            await expect.poll(async () => (await drafts(page)).dirty).toEqual([]);
            expect(JSON.parse(await bytes(page, localePath)).namespaces.safety.line).toBe('Panel after raw');
        });


        test(`${name} saves valid raw inline locale removal and retains malformed manifest drafts`, async ({ page }) => {
            const { root } = await project(page, name, true);
            const filePath = `${root}/game.json`;
            const original = await bytes(page, filePath);
            await page.evaluate(async filePath => {
                const { openProjectEntry } = await import('/src/services/openProjectEntry/index.ts');
                await openProjectEntry(filePath, 'game.json', { forceView: 'json' });
            }, filePath);
            const monaco = page.locator('.monaco-editor .native-edit-context, .monaco-editor textarea.inputarea:not([readonly])').first();
            await expect(page.locator('.monaco-editor').first()).toBeVisible();
            await expect(monaco).toBeAttached();
            await monaco.focus();
            await expect(monaco).toBeFocused();
            await page.keyboard.press('Control+a');
            await page.keyboard.type('not json');
            expect((await saveAll(page)).failed).toEqual([filePath]);
            expect(await bytes(page, filePath)).toBe(original);
            const next = JSON.parse(original);
            delete next.localization.locales.en;
            next.localization.defaultLocale = 'fr';
            await setMonacoText(page, filePath, JSON.stringify(next));
            await monaco.focus();
            await page.keyboard.press('Control+s');
            await expect.poll(async () => (await drafts(page)).dirty).toEqual([]);
            expect(Object.keys(JSON.parse(await bytes(page, filePath)).localization.locales)).toEqual(['fr']);
        });

        test(`${name} shares inline locale drafts and protects manifest metadata`, async ({ page }) => {
            const { root } = await project(page, name, true);
            const before = JSON.parse(await bytes(page, `${root}/game.json`));
            const input = page.getByRole('textbox', { name: label, exact: true });
            await input.fill('Inline English');
            await select(page, 'fr');
            await input.fill('Inline French');
            await select(page, 'en');
            await expect(input).toHaveValue('Inline English');
            expect((await drafts(page)).dirty).toEqual([`${root}/game.json`]);
            await page.getByPlaceholder('New locale', { exact: true }).fill('de');
            await page.getByRole('button', { name: 'Add locale', exact: true }).click();
            await expect(page.getByText('Manifest has unsaved edits. Save it before adding a locale.', { exact: true })).toBeVisible();
            expect(await saveAll(page)).toMatchObject({ failed: [], saved: [`${root}/game.json`], skipped: [] });
            const after = JSON.parse(await bytes(page, `${root}/game.json`));
            expect(after.localization.locales.en.namespaces.safety.line).toBe('Inline English');
            expect(after.localization.locales.fr.namespaces.safety.line).toBe('Inline French');
            const cache = await page.evaluate(async () => (await import('/src/store/storeBootstrap.ts')).useProjectStore.getState().locales);
            expect(cache.en.namespaces.safety.line).toBe('Inline English');
            expect(cache.fr.namespaces.safety.line).toBe('Inline French');
            expect({ ...after, localization: undefined }).toEqual({ ...before, localization: undefined });
            await previewTranslation(page, root, 'en', 'Inline English');
        });
    }
});
