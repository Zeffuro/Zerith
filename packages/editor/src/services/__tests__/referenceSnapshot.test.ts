import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type { useReferenceScanner as ScannerHook } from '../../hooks/useReferenceScanner';
import type { useProjectStore as ProjectStore } from '../../store/storeBootstrap';
import type { useReferenceStore as ReferenceStore } from '../../store/useReferenceStore';
import type { refreshReferenceScannerState as Refresh } from '../referenceScanner/refresh';

const mocks = vi.hoisted(() => ({
    join: vi.fn<(...parts: string[]) => Promise<string>>(),
    report: vi.fn(),
    setup: undefined as (() => (() => void)) | undefined,
}));
vi.mock('react', async importOriginal => ({
    ...await importOriginal<typeof import('react')>(),
    useLayoutEffect: (setup: () => (() => void)) => { mocks.setup = setup; },
}));
vi.mock('../../store/actions/consoleMessageActions', () => ({ executeConsoleMessageAction: mocks.report }));
vi.mock('../fs', () => ({
    fsJoin: mocks.join,
    fsMkdir: vi.fn(),
    fsReadDirectory: () => Promise.resolve(['old.png', 'new.png'].map(name => ({ isDirectory: false, isFile: true, name }))),
    fsReadTextFile: vi.fn(),
    fsWriteTextFile: vi.fn(),
}));

let useProjectStore: typeof ProjectStore;
let useReferenceStore: typeof ReferenceStore;
let refresh: typeof Refresh;
let useReferenceScanner: typeof ScannerHook;
let stop: (() => void) | undefined;
const item = (imageUrl: string) => ({ description: '', imageUrl, name: 'Badge' });
const blank = () => ({ assetFiles: {}, assets: {}, characters: {}, items: {}, variables: {} });
function deferred<T>() {
    let resolve!: (value: T) => void;
    let reject!: (error: Error) => void;
    const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
    return { promise, reject, resolve };
}
async function held() {
    const gate = deferred<string>();
    mocks.join.mockReturnValueOnce(gate.promise);
    const run = refresh();
    await settle();
    expect(mocks.join).toHaveBeenCalled();
    return { gate, run };
}
function mount() { ScannerSubject(); stop = mocks.setup!(); }
function ScannerSubject() {
    useReferenceScanner();
}
async function settle() { for (let index = 0; index < 15; index++) await Promise.resolve(); }
beforeAll(async () => {
    vi.stubGlobal('document', { createElement: () => ({ canPlayType: () => 'probably' }) });
    vi.stubGlobal('window', {});
    ({ useProjectStore } = await import('../../store/storeBootstrap'));
    ({ useReferenceStore } = await import('../../store/useReferenceStore'));
    ({ refreshReferenceScannerState: refresh } = await import('../referenceScanner/refresh'));
    ({ useReferenceScanner } = await import('../../hooks/useReferenceScanner'));
});
beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mocks.join.mockReset().mockImplementation((...parts) => Promise.resolve(parts.join('/')));
    useProjectStore.getState().setProject('/A', []);
    useProjectStore.setState({ items: { badge: item('/assets/old.png') }, manifest: { items: 'items.json' } });
});
afterEach(() => { stop?.(); stop = undefined; vi.useRealTimers(); });
afterAll(() => { vi.unstubAllGlobals(); });

describe('shared reference snapshots with actual project and reference stores', () => {
    it('refreshes real item classification and manifest navigation from loaded inputs', async () => {
        await refresh();
        expect(useReferenceStore.getState().getAssetDependencyGraph().unused).toEqual(['/assets/new.png']);
        useProjectStore.setState({ items: { badge: item('/assets/new.png') }, manifest: { items: 'next-items.json' } });
        await refresh();
        const state = useReferenceStore.getState();
        expect(state.getAssetDependencyGraph().unused).toEqual(['/assets/old.png']);
        expect(state.result.assetFiles['/assets/new.png'][0].filePath).toBe('/A/next-items.json');
    });

    it('publishes one matched result/inventory pair to synchronous subscribers', async () => {
        const pairs: { inventory: string[]; used: string[] }[] = [];
        const unsubscribe = useReferenceStore.subscribe(state => pairs.push({ inventory: state.assetInventory, used: Object.keys(state.result.assetFiles) }));
        try { await refresh(); } finally { unsubscribe(); }
        expect(pairs).toEqual([{ inventory: ['/assets/new.png', '/assets/old.png'], used: ['/assets/old.png'] }]);
    });

    it.each(['/A', '/B', undefined])('clears both old fields synchronously on replacement to %s', async path => {
        await refresh();
        const snapshots: unknown[] = [];
        const unsubscribe = useReferenceStore.subscribe(state => snapshots.push([state.result, state.assetInventory]));
        try {
            useProjectStore.getState().setProject(path, []);
            expect(useReferenceStore.getState()).toMatchObject({ assetInventory: [], result: blank() });
            expect(snapshots).toEqual([[blank(), []]]);
        } finally { unsubscribe(); }
    });

    it.each(['/A', '/B', undefined])('drops a pending default refresh after replacement to %s', async path => {
        const { gate, run } = await held();
        useProjectStore.getState().setProject(path, []);
        const successor = useReferenceStore.getState();
        gate.resolve('/A/assets'); await run;
        expect(useReferenceStore.getState()).toBe(successor);
    });

    it('does not revive an old request through A to B to A', async () => {
        const { gate, run } = await held();
        useProjectStore.getState().setProject('/B', []);
        useProjectStore.getState().setProject('/A', []);
        const successor = useReferenceStore.getState();
        gate.resolve('/A/assets'); await run;
        expect(useReferenceStore.getState()).toBe(successor);
    });

    it.each(['characters', 'items', 'macros', 'manifest', 'scenes', 'treeRevision'] as const)('retires an in-flight scan on %s replacement and restoration', async field => {
        const { gate, run } = await held();
        const original = useProjectStore.getState();
        const value = field === 'treeRevision' ? original.treeRevision + 1 : {};
        useProjectStore.setState({ [field]: value });
        useProjectStore.setState({ [field]: original[field] });
        const successor = useReferenceStore.getState();
        gate.resolve('/A/assets'); await run;
        expect(useReferenceStore.getState()).toBe(successor);
    });

    it('keeps a completed successor when the older same-session request completes later', async () => {
        const { gate, run } = await held();
        await refresh();
        const successor = useReferenceStore.getState();
        gate.resolve('/A/assets'); await run;
        expect(useReferenceStore.getState()).toBe(successor);
    });

    it('does not publish into a held successor', async () => {
        const first = await held();
        const second = await held();
        const before = useReferenceStore.getState();
        first.gate.resolve('/A/assets'); await first.run;
        expect(useReferenceStore.getState()).toBe(before);
        second.gate.resolve('/A/assets'); await second.run;
        expect(useReferenceStore.getState().result.assetFiles['/assets/old.png']).toHaveLength(1);
    });

    it('has no second stale publication after a subscriber changes the session', async () => {
        let changed = false;
        const unsubscribe = useReferenceStore.subscribe(state => {
            if (changed || state.assetInventory.length === 0) return;
            changed = true;
            expect(state.result.assetFiles['/assets/old.png']).toHaveLength(1);
            useProjectStore.getState().setProject('/B', []);
        });
        try { await refresh(); } finally { unsubscribe(); }
        expect(changed).toBe(true);
        expect(useReferenceStore.getState()).toMatchObject({ assetInventory: [], result: blank() });
    });

    it('preserves caller retirement and does not start reads for a retired caller', async () => {
        await expect(refresh(() => false)).rejects.toThrow('cancelled');
        expect(mocks.join).not.toHaveBeenCalled();
        let current = true;
        const gate = deferred<string>(); mocks.join.mockReturnValueOnce(gate.promise);
        const run = refresh(() => current);
        await settle(); current = false;
        gate.resolve('/A/assets'); await run;
        expect(useReferenceStore.getState().assetInventory).toEqual([]);
    });

    it('passes current failures to callers and preserves the last complete snapshot', async () => {
        await refresh(); const before = useReferenceStore.getState();
        mocks.join.mockRejectedValueOnce(new Error('Current scan denied'));
        await expect(refresh()).rejects.toThrow('Current scan denied');
        expect(useReferenceStore.getState()).toBe(before);
        await refresh(); expect(useReferenceStore.getState()).not.toBe(before);
    });

    it.each(['session', 'request'] as const)('suppresses a rejected %s-retired request and its error reporter', async reason => {
        const { gate, run } = await held();
        if (reason === 'session') useProjectStore.getState().setProject('/B', []);
        else await refresh();
        const before = useReferenceStore.getState();
        gate.reject(new Error('Obsolete scan denied'));
        await expect(run).resolves.toMatchObject({ assetInventory: [] });
        expect(useReferenceStore.getState()).toBe(before);
    });
});

describe('automatic scanner lifetime and loaded input subscription', () => {
    it('scans an item-only and manifest-only change without a React rerender', async () => {
        mount(); await vi.advanceTimersByTimeAsync(500);
        useProjectStore.setState({ items: { badge: item('/assets/new.png') } });
        await vi.advanceTimersByTimeAsync(500);
        expect(useReferenceStore.getState().getAssetDependencyGraph().unused).toEqual(['/assets/old.png']);
        useProjectStore.setState({ manifest: { items: 'renamed-items.json' } });
        await vi.advanceTimersByTimeAsync(500);
        expect(useReferenceStore.getState().result.assetFiles['/assets/new.png'][0].filePath).toBe('/A/renamed-items.json');
    });

    it.each(['characters', 'items', 'macros', 'manifest', 'projectGeneration', 'projectPath', 'scenes', 'treeRevision'] as const)('schedules %s changes while ignoring unrelated edits', async field => {
        mount(); await vi.advanceTimersByTimeAsync(500);
        const baseline = mocks.join.mock.calls.length;
        useProjectStore.setState({ dirtyFiles: new Set(['/A/notes.json']) });
        await vi.advanceTimersByTimeAsync(500);
        expect(mocks.join).toHaveBeenCalledTimes(baseline);
        const changes = { projectGeneration: useProjectStore.getState().projectGeneration + 1, projectPath: '/B', treeRevision: 1 };
        const value = field in changes ? changes[field as keyof typeof changes] : {};
        useProjectStore.setState({ [field]: value });
        await vi.advanceTimersByTimeAsync(500);
        expect(mocks.join.mock.calls.length).toBeGreaterThan(baseline);
    });

    it('coalesces input changes before dispatch and stops timers on close', async () => {
        mount();
        useProjectStore.setState({ items: { badge: item('/assets/new.png') } });
        useProjectStore.setState({ manifest: { items: 'latest.json' } });
        await vi.advanceTimersByTimeAsync(500);
        expect(useReferenceStore.getState().result.assetFiles['/assets/new.png'][0].filePath).toBe('/A/latest.json');
        const baseline = mocks.join.mock.calls.length;
        useProjectStore.setState({ items: {} });
        useProjectStore.getState().setProject(undefined, []);
        await vi.advanceTimersByTimeAsync(500);
        expect(mocks.join).toHaveBeenCalledTimes(baseline);
        expect(useReferenceStore.getState().assetInventory).toEqual([]);
    });

    it('retires a running automatic scan on layout cleanup and removes its subscription', async () => {
        const gate = deferred<string>(); mocks.join.mockReturnValueOnce(gate.promise);
        mount(); await vi.advanceTimersByTimeAsync(500);
        stop!(); stop = undefined;
        gate.resolve('/A/assets'); await settle();
        expect(useReferenceStore.getState().assetInventory).toEqual([]);
        const baseline = mocks.join.mock.calls.length;
        useProjectStore.setState({ items: {} }); await vi.advanceTimersByTimeAsync(500);
        expect(mocks.join).toHaveBeenCalledTimes(baseline);
    });

    it('reports a current rejection without an unhandled promise and recovers later', async () => {
        mocks.join.mockRejectedValueOnce(new Error('Scan permission denied'));
        mount(); await vi.advanceTimersByTimeAsync(500);
        expect(mocks.report).toHaveBeenCalledWith('editor', 'error', 'Reference scan failed:', 'Error: Scan permission denied');
        useProjectStore.setState({ treeRevision: 1 }); await vi.advanceTimersByTimeAsync(500);
        expect(useReferenceStore.getState().assetInventory).toHaveLength(2);
        expect(mocks.report).toHaveBeenCalledOnce();
    });

    it('does not report an obsolete automatic failure while a manual successor completes', async () => {
        const gate = deferred<string>(); mocks.join.mockReturnValueOnce(gate.promise);
        mount(); await vi.advanceTimersByTimeAsync(500);
        await refresh(); const successor = useReferenceStore.getState();
        gate.reject(new Error('Old automatic denied')); await settle();
        expect(mocks.report).not.toHaveBeenCalled();
        expect(useReferenceStore.getState()).toBe(successor);
    });
});
