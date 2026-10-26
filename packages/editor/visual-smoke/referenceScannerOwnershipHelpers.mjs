import { expect } from '@playwright/test';
import { mountFixture, openFixture, readFixture } from './authoringHelpers.mjs';

export const first = '/assets/reference-owner-a.png';
export const second = '/assets/reference-owner-b.png';

export async function install(page) {
    await page.evaluate(async () => {
        const { browserFsAdapter: fs } = await import('/src/services/fs/browserFsAdapter.ts');
        const { useProjectStore: projects } = await import('/src/store/storeBootstrap.ts');
        const { useReferenceStore: references } = await import('/src/store/useReferenceStore.ts');
        const { useConsoleStore: consoleStore } = await import('/src/store/useConsoleStore.ts');
        const owned = globalThis.__referenceOwned = { gates: [], events: [], reads: [], tasks: [], pending: new Set(), restores: [], reports: [] };
        owned.projects = projects;
        owned.references = references;
        owned.capture = state => ({ result: structuredClone(state.result), inventory: [...state.assetInventory] });
        owned.restores.push(references.subscribe((state, previous) => {
            owned.events.push({ ...owned.capture(state), resultChanged: state.result !== previous.result,
                inventoryChanged: state.assetInventory !== previous.assetInventory,
                path: projects.getState().projectPath, generation: projects.getState().projectGeneration });
        }));
        owned.restores.push(consoleStore.subscribe((state, previous) => {
            for (const message of state.messages) {
                if (!previous.messages.some(entry => entry.id === message.id)) owned.reports.push(message);
            }
        }));
        for (const method of ['readDirectory', 'readTextFile', 'join']) {
            const original = fs[method];
            owned.restores.push(() => { fs[method] = original; });
            fs[method] = function (...args) {
                const operation = (async () => {
                    const value = await original.apply(this, args);
                    const candidate = method === 'join' ? value : args[0];
                    owned.reads.push({ method, path: candidate });
                    const gate = owned.gates.find(entry => !entry.started && entry.method === method && entry.path === candidate);
                    if (gate) {
                        gate.started = true;
                        try {
                            await gate.pending;
                            if (gate.fail) throw new Error('Reference ownership injected failure');
                        } finally { gate.settled = true; }
                    }
                    return value;
                })();
                owned.pending.add(operation);
                operation.then(() => owned.pending.delete(operation), () => owned.pending.delete(operation));
                return operation;
            };
        }
    });
}

export async function fixture(page, name) {
    const files = await readFixture(name);
    const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aV1cAAAAASUVORK5CYII=';
    files[first.slice(1)] = png;
    files[second.slice(1)] = png;
    const manifest = JSON.parse(Buffer.from(files['game.json'], 'base64').toString('utf8'));
    const itemPath = manifest.items ?? 'data/reference-owner-items.json';
    manifest.items = itemPath;
    files[itemPath.replace(/^\//u, '')] = Buffer.from(JSON.stringify({ referenceOwner: { name: 'Reference Owner', imageUrl: first } })).toString('base64');
    files['game.json'] = Buffer.from(JSON.stringify(manifest)).toString('base64');
    const root = await mountFixture(page, files);
    const before = await count(page);
    await openFixture(page, root);
    await expect.poll(() => snapshot(page)).toMatchObject({ inventory: expect.arrayContaining([first, second]), result: { assetFiles: { [first]: expect.any(Array) } } });
    await expect.poll(() => count(page)).toBeGreaterThan(before);
    await idle(page);
    return { files, root };
}

export const snapshot = page => page.evaluate(() => globalThis.__referenceOwned.capture(globalThis.__referenceOwned.references.getState()));
export const count = page => page.evaluate(() => globalThis.__referenceOwned.events.length);
export const idle = page => expect.poll(() => page.evaluate(() => globalThis.__referenceOwned.pending.size)).toBe(0);
export const frames = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));

export async function gate(page, root, method = 'readDirectory', fail = false, suffix = '/assets') {
    return page.evaluate(({ root, method, fail, suffix }) => {
        let release;
        const pending = new Promise(resolve => { release = resolve; });
        return globalThis.__referenceOwned.gates.push({ method, path: `${root}${suffix}`, fail, pending, release, started: false, settled: false }) - 1;
    }, { root, method, fail, suffix });
}

export const started = (page, id) => expect.poll(() => page.evaluate(id => globalThis.__referenceOwned.gates[id].started, id)).toBe(true);
export async function release(page, id) {
    await page.evaluate(id => globalThis.__referenceOwned.gates[id].release(), id);
    await expect.poll(() => page.evaluate(id => globalThis.__referenceOwned.gates[id].settled, id)).toBe(true);
    await frames(page);
}

export async function manual(page, caller = true) {
    return page.evaluate(async caller => {
        const { refreshReferenceScannerState } = await import('/src/services/referenceScanner/refresh.ts');
        const task = { done: false };
        const index = globalThis.__referenceOwned.tasks.push(task) - 1;
        task.pending = refreshReferenceScannerState(() => caller && task.current !== false).then(
            value => { task.snapshot = value; task.done = true; },
            error => { task.error = String(error); task.done = true; },
        );
        return index;
    }, caller);
}

export const done = (page, id) => expect.poll(() => page.evaluate(id => globalThis.__referenceOwned.tasks[id].done, id)).toBe(true);
export async function update(page, kind, value = second) {
    return page.evaluate(({ kind, value }) => {
        const store = globalThis.__referenceOwned.projects;
        const state = store.getState();
        if (kind === 'items') store.setState({ items: { ...state.items, referenceOwner: { name: 'Reference Owner', imageUrl: value } } });
        else if (kind === 'characters') store.setState({ characters: { ...state.characters, referenceOwner: { portraitUrl: value } } });
        else if (kind === 'scenes') store.setState({ scenes: { ...state.scenes, [Object.keys(state.scenes)[0]]: [{ type: 'set', key: value, value: 1 }] } });
        else if (kind === 'macros') store.setState({ macros: { ...state.macros, referenceOwner: [{ type: 'set', key: value, value: 1 }] } });
        else if (kind === 'manifest') store.setState({ manifest: { ...state.manifest, items: value } });
        else store.setState({ [kind]: state[kind] + 1 });
        return { path: state.projectPath, generation: store.getState().projectGeneration };
    }, { kind, value });
}

export async function cleanup(page) {
    await page.evaluate(async () => {
        const owned = globalThis.__referenceOwned;
        if (!owned) return;
        for (const entry of owned.gates) entry.release();
        await Promise.allSettled([...owned.pending, ...owned.tasks.map(task => task.pending)]);
        for (const restore of owned.restores.reverse()) restore();
    });
}

export async function coherent(page) {
    const events = await page.evaluate(() => globalThis.__referenceOwned.events);
    expect(events.length).toBeGreaterThan(0);
    for (const event of events) {
        if (event.inventory.length === 0) {
            expect(event.result).toEqual({ assetFiles: {}, assets: {}, characters: {}, items: {}, variables: {} });
            continue;
        }
        expect(event.resultChanged, JSON.stringify(event)).toBe(true);
        expect(event.inventoryChanged, JSON.stringify(event)).toBe(true);
    }
}
