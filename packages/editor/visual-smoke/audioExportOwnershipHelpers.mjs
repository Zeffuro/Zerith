import { expect } from '@playwright/test';
import { dock, mountFixture, openFixture, readFixture } from './authoringHelpers.mjs';

export const source = '/assets/ownership-tone.wav';
export const sheet = '/assets/ownership-cues-a.sheet.json';
export const workflows = ['selection', 'editor batch', 'review single', 'review visible'];
export const countFor = workflow => workflow === 'selection' ? 1 : workflow === 'review visible' ? 3 : 2;

function tone() {
    const bytes = Buffer.alloc(44 + 16000);
    bytes.write('RIFF'); bytes.writeUInt32LE(bytes.length - 8, 4); bytes.write('WAVEfmt ', 8);
    bytes.writeUInt32LE(16, 16); bytes.writeUInt16LE(1, 20); bytes.writeUInt16LE(1, 22);
    bytes.writeUInt32LE(8000, 24); bytes.writeUInt32LE(16000, 28);
    bytes.writeUInt16LE(2, 32); bytes.writeUInt16LE(16, 34); bytes.write('data', 36); bytes.writeUInt32LE(16000, 40);
    for (let frame = 0; frame < 8000; frame++) bytes.writeInt16LE(Math.round(Math.sin(frame / 13) * 12000), 44 + frame * 2);
    return bytes.toString('base64');
}

export async function fixture(page, name) {
    const files = await readFixture(name);
    files[source.slice(1)] = tone();
    files['assets/ownership-other.wav'] = tone();
    for (const [name, cues] of Object.entries({
        'ownership-cues-a.sheet.json': { alpha: { start: 0.1, duration: 0.2 }, beta: { start: 0.5, duration: 0.2 } },
        'ownership-cues-b.sheet.json': { gamma: { start: 0.75, duration: 0.1 } },
    })) files[`assets/${name}`] = Buffer.from(JSON.stringify({ schemaVersion: 2, source: 'ownership-tone.wav', cues })).toString('base64');
    const root = await mountFixture(page, files);
    await openFixture(page, root);
    await expect.poll(() => page.evaluate(async sheet => {
        const { useReferenceStore } = await import('/src/store/useReferenceStore.ts');
        const inventory = useReferenceStore.getState().assetInventory;
        return inventory.includes(sheet) && inventory.includes('/assets/ownership-cues-b.sheet.json');
    }, sheet)).toBe(true);
    return { files, root };
}

export function button(page, workflow) {
    if (workflow === 'selection') return page.getByTitle('Save selected audio region to the project', { exact: true });
    if (workflow === 'editor batch') return page.getByRole('button', { name: /^(Save All Cues|Saving Cues\.\.\.)$/u });
    return page.getByTitle(workflow === 'review single' ? `Export cues from ${sheet}` : 'Export visible audiosheet cues as WAV files', { exact: true });
}

export async function prepare(page, root, workflow, asset = source) {
    if (workflow.startsWith('review')) {
        await dock(page, 'asset_dependencies');
        await page.getByRole('textbox', { name: 'Search audio cue review', exact: true }).fill('ownership-cues');
        await expect(page.getByTitle(`Export cues from ${sheet}`, { exact: true })).toBeEnabled();
        await expect(page.getByTitle('Export cues from /assets/ownership-cues-b.sheet.json', { exact: true })).toBeEnabled();
    } else {
        await page.evaluate(async ({ root, workflow, asset, sheet }) => {
            const { useEditorStore } = await import('/src/store/useEditorStore.ts');
            const { useWorkbenchStore } = await import('/src/store/useWorkbenchStore.ts');
            const { browserFsAdapter: fs } = await import('/src/services/fs/browserFsAdapter.ts');
            const tabs = useWorkbenchStore.getState();
            if (workflow === 'selection') {
                tabs.openOrFocusTab({ id: `asset::${asset}`, kind: 'asset', path: asset, assetPath: asset, title: asset.split('/').at(-1) });
                useEditorStore.getState().setSelectedAssetPath(asset);
            } else {
                const path = `${root}${sheet}`;
                const textContent = await fs.readTextFile(path);
                tabs.setLastAudiosheetView('timeline');
                tabs.openOrFocusTab({ id: `audiosheet::${path}`, kind: 'audiosheet', path, title: 'ownership-cues-a.json', textContent, savedTextContent: textContent, preferredView: 'timeline' });
            }
        }, { root, workflow, asset, sheet });
        await dock(page, 'editor');
        if (workflow === 'selection') {
            await expect(page.locator('input[list="asset-preview-options"]')).toHaveValue(asset);
            await expect(page.getByText('Rate:', { exact: false })).toContainText('Hz');
            const canvas = page.getByText('Asset Preview', { exact: true }).locator('..').locator('canvas');
            const box = await canvas.boundingBox();
            await page.keyboard.down('Shift');
            await page.mouse.move(box.x + box.width * 0.15, box.y + box.height / 2);
            await page.mouse.down();
            await page.mouse.move(box.x + box.width * 0.55, box.y + box.height / 2, { steps: 5 });
            await page.mouse.up();
            await page.keyboard.up('Shift');
        }
    }
    await expect(button(page, workflow)).toBeEnabled();
}

export async function install(page) {
    await page.evaluate(async () => {
        const { browserFsAdapter: fs } = await import('/src/services/fs/browserFsAdapter.ts');
        const { useReferenceStore } = await import('/src/store/useReferenceStore.ts');
        const state = globalThis.__audioOwned = { gates: [], restores: [], pending: new Set(), attempts: [], saved: [], publications: 0, aborts: 0 };
        state.base64 = bytes => {
            const chunks = [];
            for (let offset = 0; offset < bytes.length; offset += 32768) chunks.push(String.fromCharCode(...bytes.subarray(offset, offset + 32768)));
            return btoa(chunks.join(''));
        };
        state.hold = async (kind, candidate) => {
            const gate = state.gates.find(entry => !entry.started && entry.kind === kind && (entry.path === undefined || entry.path === candidate));
            if (!gate) return;
            gate.started = true;
            try { await gate.pending; if (gate.fail) throw new Error('Deferred audio export denied'); }
            finally { gate.settled = true; }
        };
        for (const method of ['readDirectory', 'readTextFile', 'readBinaryFile', 'writeBinaryFileExclusive']) {
            const original = fs[method];
            state.restores.push(() => { fs[method] = original; });
            fs[method] = function (path, ...args) {
                const operation = (async () => {
                    if (method === 'writeBinaryFileExclusive') {
                        state.attempts.push({ path, bytes: state.base64(args[0]) });
                        await state.hold('write', path);
                    }
                    const result = await original.call(this, path, ...args);
                    if (method === 'writeBinaryFileExclusive') {
                        state.saved.push({ path, bytes: state.base64(args[0]) });
                        const target = state.gates.find(entry => entry.kind === 'committed' && !entry.started && state.saved.length === entry.after);
                        if (target) await state.hold('committed');
                    } else {
                        await state.hold(method, path);
                        const target = state.gates.find(entry => entry.kind === 'refresh' && !entry.started && state.saved.length === entry.after && path === entry.path);
                        if (target && method === 'readDirectory') await state.hold('refresh', path);
                    }
                    return result;
                })();
                state.pending.add(operation);
                operation.then(() => state.pending.delete(operation), () => state.pending.delete(operation));
                return operation;
            };
        }
        const prototype = AudioContext.prototype;
        const decode = prototype.decodeAudioData;
        prototype.decodeAudioData = function (...args) {
            const operation = (async () => {
                const result = await decode.apply(this, args);
                await state.hold('decode');
                return result;
            })();
            state.pending.add(operation);
            operation.then(() => state.pending.delete(operation), () => state.pending.delete(operation));
            return operation;
        };
        state.restores.push(() => { prototype.decodeAudioData = decode; });
        const filePrototype = FileSystemFileHandle.prototype;
        const createWritable = filePrototype.createWritable;
        filePrototype.createWritable = async function (...args) {
            const stream = await createWritable.apply(this, args);
            if (!this.name.endsWith('.wav') || !state.gates.some(entry => entry.kind === 'stream' && !entry.started)) return stream;
            const write = stream.write.bind(stream);
            const abort = stream.abort.bind(stream);
            stream.write = async bytes => { await write(bytes); await state.hold('stream'); };
            stream.abort = async (...args) => { state.aborts += 1; return abort(...args); };
            return stream;
        };
        state.restores.push(() => { filePrototype.createWritable = createWritable; });
        state.restores.push(useReferenceStore.subscribe(() => {
            state.publications += 1;
        }));
    });
}

export async function gate(page, kind, path, fail = false, after) {
    return page.evaluate(({ kind, path, fail, after }) => {
        let release;
        const pending = new Promise(resolve => { release = resolve; });
        return globalThis.__audioOwned.gates.push({ kind, path, fail, after, pending, release, started: false, settled: false }) - 1;
    }, { kind, path, fail, after });
}

export async function started(page, id) {
    await expect.poll(() => page.evaluate(id => globalThis.__audioOwned.gates[id].started, id)).toBe(true);
}

export async function release(page, id) {
    await page.evaluate(id => globalThis.__audioOwned.gates[id].release(), id);
    await expect.poll(() => page.evaluate(id => globalThis.__audioOwned.gates[id].settled, id)).toBe(true);
    await frames(page);
}

export const frames = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));

export async function replace(page, root) {
    const generation = await page.evaluate(async root => {
        const { useProjectStore } = await import('/src/store/storeBootstrap.ts');
        const before = useProjectStore.getState().projectGeneration;
        if (!await useProjectStore.getState().openProjectFromManifest(`${root}/game.json`)) throw new Error('Project replacement failed');
        return [before, useProjectStore.getState().projectGeneration];
    }, root);
    expect(generation[1]).toBeGreaterThan(generation[0]);
    await frames(page);
    await expect.poll(() => page.evaluate(async () => {
        const { useReferenceStore } = await import('/src/store/useReferenceStore.ts');
        const inventory = useReferenceStore.getState().assetInventory;
        return inventory.includes('/assets/ownership-cues-a.sheet.json') && inventory.includes('/assets/ownership-cues-b.sheet.json');
    })).toBe(true);
    await frames(page);
}

export async function verify(page, count) {
    await expect.poll(() => page.evaluate(() => globalThis.__audioOwned.saved.length)).toBe(count);
    const saved = await page.evaluate(async () => {
        const { browserFsAdapter: fs } = await import('/src/services/fs/browserFsAdapter.ts');
        return Promise.all(globalThis.__audioOwned.saved.map(async entry => ({ ...entry, actual: globalThis.__audioOwned.base64(await fs.readBinaryFile(entry.path)) })));
    });
    for (const entry of saved) {
        expect(entry.actual).toBe(entry.bytes);
        const wav = Buffer.from(entry.actual, 'base64');
        expect(wav.toString('ascii', 0, 4)).toBe('RIFF');
        expect(wav.readUInt32LE(4)).toBe(wav.length - 8);
        expect(wav.length).toBeGreaterThan(44);
    }
    return saved;
}

export async function snapshot(page) {
    return page.evaluate(async () => {
        const { useEditorStore } = await import('/src/store/useEditorStore.ts');
        const state = globalThis.__audioOwned;
        return { attempts: state.attempts.length, saved: state.saved.length, publications: state.publications,
            selected: useEditorStore.getState().selectedAssetPath,
            previewValue: document.querySelector('input[list="asset-preview-options"]')?.value };
    });
}

export async function noPublication(page, workflow, baseline) {
    await expect.poll(() => page.evaluate(() => globalThis.__audioOwned.pending.size)).toBe(1);
    expect(await snapshot(page)).toEqual(baseline);
    await expect(page.getByText(/Deferred audio export denied|Saved \d+ cue WAV|^Saved .*audio-regions/u)).toHaveCount(0);
    await expect(button(page, workflow)).toBeDisabled();
}

export async function clean(page) {
    await page.evaluate(async () => {
        const state = globalThis.__audioOwned;
        const { closeProject } = await import('/src/store/actions/projectOpenActions.ts');
        closeProject();
        if (state) {
            for (const entry of state.gates) entry.release();
            await Promise.allSettled([...state.pending]);
            await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
            for (const restore of state.restores.toReversed()) restore();
        }
    });
}
