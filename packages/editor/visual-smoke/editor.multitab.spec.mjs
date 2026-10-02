import { expect, test } from '@playwright/test';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const runtimeFailures = new WeakMap();
const externalRequests = new WeakMap();
const editorWorkers = new WeakMap();

test.describe('sustained multi-tab editing', () => {
    test.beforeEach(async ({ page }) => {
        const failures = [];
        const requests = [];
        runtimeFailures.set(page, failures);
        externalRequests.set(page, requests);
        editorWorkers.set(page, []);
        page.on('worker', worker => editorWorkers.get(page).push(worker.url()));
        page.on('pageerror', error => failures.push(`pageerror: ${error.stack ?? error.message}`));
        page.on('console', message => {
            if (message.type() === 'error') failures.push(`console.error: ${message.text()}`);
        });
        await page.route('**/*', route => {
            const url = new URL(route.request().url());
            if (!['http:', 'https:'].includes(url.protocol) || ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) return route.continue();
            if (url.hostname === 'fonts.googleapis.com') return route.fulfill({ body: '', contentType: 'text/css' });
            requests.push(url.href);
            return route.abort();
        });
        await page.addInitScript(() => localStorage.clear());
        await page.goto('/');
        await page.locator('.zerith-dock-host').waitFor();
        await harness(page, 'resetEditorChrome');
    });

    test.afterEach(async ({ page }, testInfo) => {
        await testInfo.attach('local-editor-workers', { body: JSON.stringify(editorWorkers.get(page)), contentType: 'application/json' });
        expect(externalRequests.get(page), 'Editor must load without external HTTP requests').toEqual([]);
        expect(runtimeFailures.get(page), 'Uncaught exceptions or console errors during editing').toEqual([]);
        await expect(page.getByText('Error rendering component', { exact: true })).toHaveCount(0);
    });

    test('retains scene envelopes through visual save and reopen', async ({ page }) => {
        const files = await fixture();
        const original = JSON.parse(files['scenes/intro.json']);
        original.customEditorData = { color: 'teal', positions: { opening: [13, 27] } };
        files['scenes/intro.json'] = JSON.stringify(original);
        await harness(page, 'openProjectFixture', { entryPath: 'scenes/intro.json', files, rootName: 'session', selectedPath: [5] });
        await editDialogue(page, 'Envelope save revision');
        await saveAll(page);
        const saved = JSON.parse(await harness(page, 'readFixtureFile', 'scenes/intro.json'));
        expect(saved).toEqual({ ...original, commands: expect.any(Array) });
        expect(saved.commands[5].text).toBe('Envelope save revision');
        await harness(page, 'reopenFixtureProject');
        await harness(page, 'openFixtureEntry', 'scenes/intro.json', [5]);
        expect((await harness(page, 'readEditingState')).script[5].text).toBe('Envelope save revision');
    });

    test('preserves dirty visual and JSON/text tabs across repeated edits and save-all', async ({ page }) => {
        test.setTimeout(300_000);
        const files = await fixture();
        files['session.json'] = JSON.stringify({ revision: 0, label: 'original' });
        files['session.txt'] = 'Original notes';
        const macros = JSON.parse(files['data/macros.json']);
        macros.$schema = 'zerith/macros';
        macros.$custom = { owner: 'session', retained: [1, 2] };
        macros.$tags = [{ type: 'dialogue', text: 'Reserved array metadata' }];
        macros.session_dialogue = [{ type: 'dialogue', speaker: 'aria', text: 'Original macro dialogue' }];
        files['data/macros.json'] = JSON.stringify(macros);
        await harness(page, 'openProjectFixture', { entryPath: 'scenes/intro.json', files, rootName: 'session', selectedPath: [5] });
        for (let revision = 1; revision <= 36; revision++) {
            await editDialogue(page, `Visual revision ${revision}`);
            await openEntry(page, 'scenes/chapter_one.json', [5]);
            await editDialogue(page, `Chapter revision ${revision}`);
            await openEntry(page, 'data/macros.json', [3, 'body', 0]);
            expect((await harness(page, 'readEditingState')).macroEntries.some(entry => entry.name.startsWith('$'))).toBe(false);
            await editDialogue(page, `Macro revision ${revision}`, '3.body.0');
            await openEntry(page, 'session.json');
            await editCode(page, JSON.stringify({ revision, label: `JSON revision ${revision}` }, undefined, 2));
            await openEntry(page, 'session.txt');
            await editCode(page, `Notes revision ${revision}\nSecond line survives switching.`);
            await activateTab(page, 'scenes/intro.json');
            expect((await harness(page, 'readEditingState')).script[5].text).toBe(`Visual revision ${revision}`);
            await activateTab(page, 'scenes/chapter_one.json');
            expect((await harness(page, 'readEditingState')).script[5].text).toBe(`Chapter revision ${revision}`);
            await activateTab(page, 'data/macros.json');
            expect((await harness(page, 'readEditingState')).macroEntries.find(entry => entry.name === 'session_dialogue').commands[0].text).toBe(`Macro revision ${revision}`);
            await activateTab(page, 'session.json');
            expect(JSON.parse((await harness(page, 'readEditingState')).tabs.find(tab => tab.path.endsWith('/session.json')).textContent).revision).toBe(revision);
            await activateTab(page, 'session.txt');
            expect((await harness(page, 'readEditingState')).tabs.find(tab => tab.path.endsWith('/session.txt')).textContent).toContain(`Notes revision ${revision}`);
            if (revision % 3 === 0) {
                await saveAll(page);
                expect((await harness(page, 'readEditingState')).dirtyFiles).toEqual([]);
                expect(JSON.parse(await harness(page, 'readFixtureFile', 'scenes/intro.json')).commands[5].text).toBe(`Visual revision ${revision}`);
                expect(JSON.parse(await harness(page, 'readFixtureFile', 'scenes/chapter_one.json')).commands[5].text).toBe(`Chapter revision ${revision}`);
                const savedMacros = JSON.parse(await harness(page, 'readFixtureFile', 'data/macros.json'));
                expect(savedMacros).toEqual({ ...macros, session_dialogue: [{ type: 'dialogue', speaker: 'aria', text: `Macro revision ${revision}` }] });
                expect(JSON.parse(await harness(page, 'readFixtureFile', 'session.json')).revision).toBe(revision);
                expect(await harness(page, 'readFixtureFile', 'session.txt')).toContain(`Notes revision ${revision}`);
            }
            if (revision % 9 === 0) {
                await harness(page, 'reopenFixtureProject');
                await openEntry(page, 'scenes/intro.json', [5]);
                expect((await harness(page, 'readEditingState')).script[5].text).toBe(`Visual revision ${revision}`);
                await openEntry(page, 'scenes/chapter_one.json', [5]);
                expect((await harness(page, 'readEditingState')).script[5].text).toBe(`Chapter revision ${revision}`);
                await openEntry(page, 'data/macros.json');
                expect((await harness(page, 'readEditingState')).macroEntries.find(entry => entry.name === 'session_dialogue').commands[0].text).toBe(`Macro revision ${revision}`);
                await openEntry(page, 'scenes/intro.json', [5]);
            }
            await activateTab(page, 'scenes/intro.json');
        }
        await harness(page, 'reopenFixtureProject');
        await openEntry(page, 'scenes/intro.json', [5]);
        expect((await harness(page, 'readEditingState')).script[5].text).toBe('Visual revision 36');
        await openEntry(page, 'scenes/chapter_one.json', [5]);
        expect((await harness(page, 'readEditingState')).script[5].text).toBe('Chapter revision 36');
        await openEntry(page, 'data/macros.json');
        expect((await harness(page, 'readEditingState')).macroEntries.find(entry => entry.name === 'session_dialogue').commands[0].text).toBe('Macro revision 36');
        await openEntry(page, 'session.json');
        expect(JSON.parse((await harness(page, 'readEditingState')).tabs.find(tab => tab.path.endsWith('/session.json')).textContent).revision).toBe(36);
        await openEntry(page, 'session.txt');
        expect((await harness(page, 'readEditingState')).tabs.find(tab => tab.path.endsWith('/session.txt')).textContent).toContain('Notes revision 36');
        expect(editorWorkers.get(page).some(url => url.includes('json.worker'))).toBe(true);
        expect(editorWorkers.get(page).every(url => ['127.0.0.1', 'localhost', '[::1]'].includes(new URL(url).hostname))).toBe(true);
    });
});

async function harness(page, action, ...args) {
    await page.waitForFunction(() => Boolean(window.__ZERITH_EDITOR_VISUAL_SMOKE__));
    return page.evaluate(async ([name, values]) => {
        const method = window.__ZERITH_EDITOR_VISUAL_SMOKE__[name];
        if (!method) throw new Error(`Missing smoke harness action: ${name}`);
        return method(...values);
    }, [action, args]);
}

async function editDialogue(page, text, nodePath = '5') {
    await harness(page, 'selectDockPanel', 'editor');
    await page.locator(`[data-node-path="${nodePath}"]`).click({ position: { x: 10, y: 10 } });
    await harness(page, 'selectDockPanel', 'inspector');
    const input = page.locator('textarea:not(.inputarea)').first();
    await expect(input).toBeVisible();
    await input.fill(text);
    await expect(input).toHaveValue(text);
    await expect.poll(async () => (await harness(page, 'readEditingState')).tabs.some(tab => tab.dirty && tab.textContent?.includes(text))).toBe(true);
    await expect.poll(async () => (await harness(page, 'readEditingState')).dirtyFiles.length).toBeGreaterThan(0);
    await harness(page, 'selectDockPanel', 'editor');
}

async function openEntry(page, entryPath, selectedPath) {
    await harness(page, 'openFixtureEntry', entryPath, selectedPath);
    await harness(page, 'selectDockPanel', 'editor');
    if (entryPath === 'session.json') await expect(page.getByText('JSON: session.json', { exact: true })).toBeVisible();
    if (entryPath === 'session.txt') await expect(page.getByText('Text: session.txt', { exact: true })).toBeVisible();
}

async function activateTab(page, entryPath) {
    const tab = page.locator('[data-tab-id]').filter({ hasText: path.basename(entryPath) });
    await tab.click();
    await page.waitForTimeout(50);
}

async function editCode(page, text) {
    await expect(page.locator('.monaco-editor .view-lines')).toBeVisible();
    const input = page.getByRole('textbox', { name: 'Editor content' });
    await input.focus();
    await expect(input).toBeFocused();
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.evaluate(value => navigator.clipboard.writeText(value), text);
    await page.keyboard.press('ControlOrMeta+A');
    await page.keyboard.press('ControlOrMeta+V');
    const marker = text.includes('JSON revision') ? JSON.parse(text).label : text.split('\n')[0];
    await expect.poll(async () => (await page.locator('.view-lines').innerText()).replaceAll('\u00a0', ' ')).toContain(marker);
    await page.getByRole('button', { name: 'Apply', exact: true }).click();
    await expect.poll(async () => (await harness(page, 'readEditingState')).tabs.some(tab => tab.dirty && tab.textContent?.replaceAll('\r\n', '\n') === text)).toBe(true);
}

async function saveAll(page) {
    await harness(page, 'openCommandPalette');
    const palette = page.getByRole('dialog', { name: 'Command palette' });
    await palette.getByPlaceholder('Type an action (e.g. Save All, Play, Reset Layout)').fill('save all');
    await palette.getByRole('option', { name: /Save All Files/u }).click();
    await expect(palette).toHaveCount(0);
    await expect.poll(async () => (await harness(page, 'readEditingState')).dirtyFiles).toEqual([]);
}

async function fixture() {
    const root = fileURLToPath(new URL('../../../games/classic-vn-starter', import.meta.url));
    const files = {};
    async function visit(directory) {
        for (const entry of await readdir(directory, { withFileTypes: true })) {
            if (entry.name === '.dev_docs' || entry.name === '.git') continue;
            const absolute = path.join(directory, entry.name);
            if (entry.isDirectory()) await visit(absolute);
            else if (entry.isFile()) files[path.relative(root, absolute).replaceAll(path.sep, '/')] = ['.json', '.svg'].includes(path.extname(entry.name)) ? await readFile(absolute, 'utf8') : '';
        }
    }
    await visit(root);
    return files;
}
