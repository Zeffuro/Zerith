import { expect } from '@playwright/test';
import { dock, mountFixture, openFixture, readFixture, setup, test } from './authoringHelpers.mjs';

const source = '/assets/collision-tone.wav';
const sheet = '/assets/collision-cues.sheet.json';

function tone() {
    const bytes = Buffer.alloc(44 + 16000);
    bytes.write('RIFF'); bytes.writeUInt32LE(bytes.length - 8, 4); bytes.write('WAVEfmt ', 8);
    bytes.writeUInt32LE(16, 16); bytes.writeUInt16LE(1, 20); bytes.writeUInt16LE(1, 22);
    bytes.writeUInt32LE(8000, 24); bytes.writeUInt32LE(16000, 28);
    bytes.writeUInt16LE(2, 32); bytes.writeUInt16LE(16, 34); bytes.write('data', 36); bytes.writeUInt32LE(16000, 40);
    for (let frame = 0; frame < 8000; frame++) bytes.writeInt16LE(Math.round(Math.sin(frame / 13) * 12000), 44 + frame * 2);
    return bytes.toString('base64');
}

test.beforeEach(async ({ page }) => {
    page.__audioErrors = [];
    page.on('pageerror', error => page.__audioErrors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') page.__audioErrors.push(message.text()); });
    await page.addInitScript(() => {
        globalThis.__audioRejections = [];
        globalThis.addEventListener('unhandledrejection', event => globalThis.__audioRejections.push(String(event.reason)));
    });
    await setup(page);
    await page.evaluate(async () => {
        const { useSettingsStore } = await import('/src/store/useSettingsStore.ts');
        useSettingsStore.getState().setRecoveryEnabled(false);
        useSettingsStore.getState().setAutosaveEnabled(false);
    });
});
test.afterEach(async ({ page }) => {
    await page.evaluate(async () => {
        globalThis.__restoreAudioWrite?.();
        const { closeProject } = await import('/src/store/actions/projectOpenActions.ts');
        closeProject();
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    });
    expect(page.__audioErrors).toEqual([]);
    expect(await page.evaluate(() => globalThis.__audioRejections)).toEqual([]);
    await page.goto('about:blank');
});

async function fixture(page, name) {
    const files = await readFixture(name);
    files[source.slice(1)] = tone();
    files[sheet.slice(1)] = Buffer.from(JSON.stringify({ schemaVersion: 2, source: 'collision-tone.wav', cues: {
        alpha: { start: 0.1, duration: 0.2 }, beta: { start: 0.5, duration: 0.2 },
    } })).toString('base64');
    const root = await mountFixture(page, files);
    await openFixture(page, root);
    return root;
}

async function inject(page, mode) {
    await page.evaluate(async mode => {
        const { browserFsAdapter: fs } = await import('/src/services/fs/browserFsAdapter.ts');
        const original = fs.writeBinaryFileExclusive;
        const state = globalThis.__audioWrites = { attempts: [], saved: [], original: undefined };
        globalThis.__restoreAudioWrite = () => { fs.writeBinaryFileExclusive = original; };
        fs.writeBinaryFileExclusive = async (path, content, isCurrent) => {
            state.attempts.push({ path, bytes: [...content] });
            if (mode === 'late' && state.attempts.length === 1) {
                state.original = { path, bytes: [9, 8, 7, 6] };
                await fs.writeBinaryFile(path, Uint8Array.from(state.original.bytes));
            }
            if (mode === 'permission' || mode === 'partial' && state.saved.length === 1) {
                throw Object.assign(new Error('Audio destination permission denied'), { code: 'permissionDenied' });
            }
            await original(path, content, isCurrent);
            state.saved.push({ path, bytes: [...content] });
        };
    }, mode);
}

async function verify(page, expectedSaved, expectedAttempts, preserveOriginal = false) {
    await expect.poll(() => page.evaluate(() => globalThis.__audioWrites.attempts.length)).toBe(expectedAttempts);
    const result = await page.evaluate(async () => {
        const { browserFsAdapter: fs } = await import('/src/services/fs/browserFsAdapter.ts');
        const state = globalThis.__audioWrites;
        return { ...state, actual: await Promise.all(state.saved.map(async entry => [...await fs.readBinaryFile(entry.path)])),
            originalActual: state.original ? [...await fs.readBinaryFile(state.original.path)] : undefined };
    });
    expect(result.saved).toHaveLength(expectedSaved);
    for (const [index, entry] of result.saved.entries()) {
        expect(result.actual[index]).toEqual(entry.bytes);
        expect(entry.bytes.slice(0, 4)).toEqual([82, 73, 70, 70]);
    }
    if (preserveOriginal) {
        expect(result.originalActual).toEqual(result.original.bytes);
        expect(result.saved[0].path).not.toBe(result.original.path);
        expect(result.saved[0].path).toMatch(/_2\.wav$/u);
    }
}

async function selection(page) {
    await page.evaluate(async source => {
        const { useEditorStore } = await import('/src/store/useEditorStore.ts');
        const { useWorkbenchStore } = await import('/src/store/useWorkbenchStore.ts');
        useWorkbenchStore.getState().openOrFocusTab({ id: `asset::${source}`, kind: 'asset', path: source, assetPath: source, title: 'collision-tone.wav' });
        useEditorStore.getState().setSelectedAssetPath(source);
    }, source);
    await dock(page, 'editor');
    await expect(page.getByText('Rate:', { exact: false })).toContainText('Hz');
    const canvas = page.getByText('Asset Preview', { exact: true }).locator('..').locator('canvas');
    const box = await canvas.boundingBox();
    await page.keyboard.down('Shift');
    await page.mouse.move(box.x + box.width * 0.15, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.55, box.y + box.height / 2, { steps: 5 });
    await page.mouse.up();
    await page.keyboard.up('Shift');
    await expect(page.getByRole('button', { name: 'Save to Project', exact: true })).toBeEnabled();
}

async function editor(page, root) {
    await page.evaluate(async ({ root, sheet }) => {
        const { useWorkbenchStore } = await import('/src/store/useWorkbenchStore.ts');
        const { browserFsAdapter: fs } = await import('/src/services/fs/browserFsAdapter.ts');
        const path = `${root}${sheet}`;
        const textContent = await fs.readTextFile(path);
        useWorkbenchStore.getState().setLastAudiosheetView('timeline');
        useWorkbenchStore.getState().openOrFocusTab({ id: `audiosheet::${path}`, kind: 'audiosheet', path, title: 'collision-cues.json', textContent, savedTextContent: textContent, preferredView: 'timeline' });
    }, { root, sheet });
    await dock(page, 'editor');
    await expect(page.getByRole('button', { name: 'Save All Cues', exact: true })).toBeEnabled();
}

async function review(page) {
    await dock(page, 'asset_dependencies');
    await page.getByRole('textbox', { name: 'Search audio cue review', exact: true }).fill('collision-cues');
    await expect(page.getByTitle(`Export cues from ${sheet}`, { exact: true })).toBeEnabled();
}

for (const name of ['classic-vn-starter', 'example-game']) {
    for (const workflow of ['selection', 'editor batch', 'review single', 'review visible']) {
        test(`${name}: ${workflow} preserves a destination created after planning`, async ({ page }) => {
            const root = await fixture(page, name);
            if (workflow === 'selection') await selection(page);
            else if (workflow === 'editor batch') await editor(page, root);
            else await review(page);
            await inject(page, 'late');
            const button = workflow === 'selection' ? page.getByRole('button', { name: 'Save to Project', exact: true })
                : workflow === 'editor batch' ? page.getByRole('button', { name: 'Save All Cues', exact: true })
                    : workflow === 'review single' ? page.getByTitle(`Export cues from ${sheet}`, { exact: true })
                        : page.getByTitle('Export visible audiosheet cues as WAV files', { exact: true });
            await button.click();
            if (workflow === 'selection') await expect(page.getByText(/^Saved .*\/assets\/audio-regions\/.*\(renamed\)/u)).toBeVisible();
            else await expect(page.getByText(/Saved 2 cue WAV/u)).toBeVisible();
            await verify(page, workflow === 'selection' ? 1 : 2, workflow === 'selection' ? 2 : 3, true);
        });
    }
    for (const mode of ['permission', 'partial']) {
        test(`${name}: cue batch ${mode} failure preserves completed files without retry`, async ({ page }) => {
            const root = await fixture(page, name);
            await editor(page, root);
            await inject(page, mode);
            await page.getByRole('button', { name: 'Save All Cues', exact: true }).click();
            await expect(page.getByText(/Cue export: Audio destination permission denied/u)).toBeVisible();
            await verify(page, mode === 'partial' ? 1 : 0, mode === 'partial' ? 2 : 1);
        });
    }
    test(`${name}: concurrent real browser exports preserve both exact WAV payloads`, async ({ page }) => {
        const root = await fixture(page, name);
        const result = await page.evaluate(async ({ root, source }) => {
            const { saveAudioRegionWavToProject: save } = await import('/src/services/audioRegionExport.ts');
            const { browserFsAdapter: fs } = await import('/src/services/fs/browserFsAdapter.ts');
            const original = fs.readDirectory;
            let release;
            const ready = new Promise(resolve => { release = resolve; });
            let reads = 0;
            fs.readDirectory = async path => {
                const entries = await original(path);
                if (path.endsWith('/assets/concurrent')) {
                    if (++reads === 2) release();
                    await ready;
                }
                return entries;
            };
            const bytes = await fs.readBinaryFile(`${root}${source}`);
            const other = bytes.slice(); other[44] ^= 17;
            try {
                const outputs = await Promise.all([bytes, other].map(wavBytes => save(root, { sourcePath: source, region: { start: 0, end: 1 }, wavBytes, targetFolder: 'assets/concurrent' })));
                return { outputs, expected: [[...bytes], [...other]], actual: await Promise.all(outputs.map(async entry => [...await fs.readBinaryFile(entry.targetPath)])) };
            } finally { fs.readDirectory = original; }
        }, { root, source });
        expect(new Set(result.outputs.map(entry => entry.targetPath)).size).toBe(2);
        expect(result.actual).toEqual(result.expected);
        expect(result.outputs.filter(entry => entry.collisionResolved)).toHaveLength(1);
    });
}
