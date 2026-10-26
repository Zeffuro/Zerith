import { beforeEach, describe, expect, it, vi } from 'vitest';

type Project = { projectGeneration: number; projectPath: string | undefined };
type Tab = { id: string; path: string; textContent: string };
type Workbench = { activeTabId: string | undefined; tabs: Tab[] };
const mocks = vi.hoisted(() => {
    const project: Project = { projectGeneration: 1, projectPath: '/A' };
    const workbench: Workbench = { activeTabId: 'sheet', tabs: [{ id: 'sheet', path: '/A/sheet.json', textContent: '{}' }] };
    return {
    editor: { selectedAssetPath: '/tone.wav' },
    editorListeners: new Set<(current: { selectedAssetPath: string }, previous: { selectedAssetPath: string }) => void>(),
    effects: [] as (() => void)[],
    index: 0,
    project,
    projectListeners: new Set<(current: Project, previous: Project) => void>(),
    setters: vi.fn(),
    slots: [] as { cleanup?: () => void; deps?: unknown[]; kind?: 'layout' | 'passive'; value?: unknown }[],
    workbench,
    workbenchListeners: new Set<(current: Workbench, previous: Workbench) => void>(),
    };
});
function effect(setup: () => (() => void) | void, deps: unknown[], kind: 'layout' | 'passive') {
        const index = mocks.index++;
        const previous = mocks.slots[index];
        if (!previous || deps.some((value, position) => value !== previous.deps?.[position])) {
            const slot = mocks.slots[index] = { deps, kind } as typeof previous;
            mocks.effects.push(() => { previous?.cleanup?.(); slot.cleanup = setup() ?? undefined; });
        }
}
vi.mock('react', () => {
    return {
        useEffect: (setup: () => (() => void) | void, deps: unknown[]) => effect(setup, deps, 'passive'),
        useLayoutEffect: (setup: () => (() => void) | void, deps: unknown[]) => effect(setup, deps, 'layout'),
        useRef: (value: unknown) => {
            const index = mocks.index++;
            mocks.slots[index] ??= { value: { current: value } };
            return mocks.slots[index].value;
        },
        useState: (initial: unknown) => {
            const index = mocks.index++;
            const slot = mocks.slots[index] ??= { value: initial };
            return [slot.value, (value: unknown) => {
                mocks.setters(value);
                slot.value = typeof value === 'function' ? (value as (current: unknown) => unknown)(slot.value) : value;
            }];
        },
    };
});
vi.mock('../../store/storeBootstrap', () => ({ useProjectStore: {
    getState: () => mocks.project,
    subscribe: (listener: (current: Project, previous: Project) => void) => {
        mocks.projectListeners.add(listener); return () => mocks.projectListeners.delete(listener);
    },
} }));
vi.mock('../../store/useEditorStore', () => ({ useEditorStore: {
    getState: () => mocks.editor,
    subscribe: (listener: (current: typeof mocks.editor, previous: typeof mocks.editor) => void) => {
        mocks.editorListeners.add(listener); return () => mocks.editorListeners.delete(listener);
    },
} }));
vi.mock('../../store/useWorkbenchStore', () => ({ useWorkbenchStore: {
    getState: () => mocks.workbench,
    subscribe: (listener: (current: Workbench, previous: Workbench) => void) => {
        mocks.workbenchListeners.add(listener); return () => mocks.workbenchListeners.delete(listener);
    },
} }));

import { useAudioExport } from '../useAudioExport';

function deferred() {
    let resolve!: (value: { message: string }) => void;
    let reject!: (error: Error) => void;
    const promise = new Promise<{ message: string }>((yes, no) => { resolve = yes; reject = no; });
    return { promise, reject, resolve };
}
function ExportSubject(source: string, scope: { tabId?: string; watchSelectedAsset?: boolean }) { return useAudioExport(source, scope); }
function project(path: string | undefined = '/A') {
    const previous = mocks.project;
    mocks.project = { projectGeneration: previous.projectGeneration + 1, projectPath: path };
    for (const listener of mocks.projectListeners) listener(mocks.project, previous);
}
function render(source = 'tone', scope: { tabId?: string; watchSelectedAsset?: boolean } = {}) {
    mocks.index = 0;
    const view = ExportSubject(source, scope);
    for (const effect of mocks.effects.splice(0)) effect();
    return view;
}
function selected(path: string) {
    const previous = mocks.editor;
    mocks.editor = { selectedAssetPath: path };
    for (const listener of mocks.editorListeners) listener(mocks.editor, previous);
}
function unmount(kind?: 'layout' | 'passive') { for (const slot of mocks.slots) if (!kind || slot.kind === kind) slot.cleanup?.(); }
function workbench(next: Workbench) {
    const previous = mocks.workbench;
    mocks.workbench = next;
    for (const listener of mocks.workbenchListeners) listener(next, previous);
}

describe('audio export caller ownership', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        mocks.project = { projectGeneration: 1, projectPath: '/A' };
        mocks.editor = { selectedAssetPath: '/tone.wav' };
        mocks.workbench = { activeTabId: 'sheet', tabs: [{ id: 'sheet', path: '/A/sheet.json', textContent: '{}' }] };
        mocks.effects.length = mocks.slots.length = 0;
        mocks.projectListeners.clear(); mocks.editorListeners.clear(); mocks.workbenchListeners.clear();
    });

    it('keeps current success and synchronously suppresses duplicate calls', async () => {
        const pending = deferred();
        const operation = vi.fn(() => pending.promise);
        const success = vi.fn();
        const view = render();
        const run = view.runExport('selection', operation, success);
        await view.runExport('duplicate', operation, success);
        expect(operation).toHaveBeenCalledOnce();
        expect(render()).toMatchObject({ exportingTarget: 'selection', isExporting: true });
        pending.resolve({ message: 'Saved' }); await run;
        expect(render()).toMatchObject({ isExporting: false, message: 'Saved' });
        expect(success).toHaveBeenCalledOnce();
    });

    it.each(['/B', '/A', undefined])('retires %j immediately and refuses stale rendered callers', async path => {
        const pending = deferred();
        const operation = vi.fn((_path, current: () => boolean) => { expect(current()).toBe(true); return pending.promise; });
        const staleView = render();
        const run = staleView.runExport('selection', operation);
        project(path);
        expect(operation.mock.calls[0][1]()).toBe(false);
        await staleView.runExport('stale', operation);
        expect(operation).toHaveBeenCalledOnce();
        expect(render().isExporting).toBe(false);
        const calls = mocks.setters.mock.calls.length;
        pending.resolve({ message: 'Obsolete' }); await run;
        expect(mocks.setters).toHaveBeenCalledTimes(calls);
        expect(render().message).toBeUndefined();
    });

    it.each(['old-first', 'new-first'] as const)('isolates successor busy and success when %s finishes', async order => {
        const next = deferred(), old = deferred(), success = vi.fn();
        const first = render().runExport('old', () => old.promise, success);
        project();
        const second = render().runExport('next', () => next.promise);
        if (order === 'old-first') {
            old.resolve({ message: 'Old' }); await first;
            expect(render()).toMatchObject({ exportingTarget: 'next', isExporting: true });
            next.resolve({ message: 'Next' }); await second;
        } else {
            next.resolve({ message: 'Next' }); await second;
            old.reject(new Error('Obsolete')); await first;
        }
        expect(render()).toMatchObject({ isExporting: false, message: 'Next' });
        expect(success).not.toHaveBeenCalled();
    });

    it('cannot revive an A->B->A request within one store turn', async () => {
        const pending = deferred();
        const operation = vi.fn((_path, current: () => boolean) => pending.promise.then(result => { expect(current()).toBe(false); return result; }));
        const run = render().runExport('old', operation);
        project('/B'); project('/A');
        pending.resolve({ message: 'Old' }); await run;
        expect(render().message).toBeUndefined();
    });

    it('retires source input synchronously and keeps a completed selection message on automatic source change', async () => {
        const pending = deferred();
        const view = render();
        const run = view.runExport('old', () => pending.promise);
        view.retire();
        render('other');
        pending.reject(new Error('Old')); await run;
        expect(render('other').message).toBeUndefined();
        await render('other').runExport('new', () => Promise.resolve({ message: 'Saved selection' }));
        render('generated.wav');
        expect(render('generated.wav').message).toBe('Saved selection');
    });

    it('retires a changed source key without an explicit UI reset', async () => {
        const pending = deferred();
        const run = render().runExport('old', () => pending.promise);
        render('replacement');
        expect(render('replacement').isExporting).toBe(false);
        pending.resolve({ message: 'Old' }); await run;
        expect(render('replacement').message).toBeUndefined();
    });

    it('retires selected-asset A->B->A synchronously', async () => {
        const pending = deferred(), scope = { watchSelectedAsset: true };
        const view = render('tone', scope);
        const run = view.runExport('old', () => pending.promise);
        selected('/other.wav'); selected('/tone.wav');
        expect(render('tone', scope).isExporting).toBe(false);
        pending.resolve({ message: 'Old' }); await run;
        expect(render('tone', scope).message).toBeUndefined();
    });

    it.each(['switch', 'close', 'replace'] as const)('retires an editor tab %s before React effects', async change => {
        const pending = deferred(), scope = { tabId: 'sheet' };
        const run = render('sheet', scope).runExport('old', () => pending.promise);
        const original = mocks.workbench;
        if (change === 'switch') {
            workbench({ ...original, activeTabId: 'other' });
            workbench(original);
        } else if (change === 'close') {
            workbench({ activeTabId: undefined, tabs: [] });
            workbench(original);
        } else workbench({ ...original, tabs: [{ ...original.tabs[0], textContent: '{"source":"other.wav"}' }] });
        expect(render('sheet', scope).isExporting).toBe(false);
        pending.resolve({ message: 'Old' }); await run;
        expect(render('sheet', scope).message).toBeUndefined();
    });

    it('drops unmounted completion and unsubscribes every store', async () => {
        const pending = deferred();
        const run = render().runExport('old', () => pending.promise);
        unmount();
        const calls = mocks.setters.mock.calls.length;
        pending.reject(new Error('Old')); await run;
        expect(mocks.setters).toHaveBeenCalledTimes(calls);
        expect(mocks.projectListeners.size + mocks.editorListeners.size + mocks.workbenchListeners.size).toBe(0);
    });

    it.each(['resolve', 'reject'] as const)('retires layout unmount before passive cleanup and late %s', async outcome => {
        const pending = deferred();
        const success = vi.fn();
        const operation = vi.fn((_path: string, current: () => boolean) => pending.promise.then(result => {
            expect(current()).toBe(false);
            return result;
        }));
        const run = render().runExport('old', operation, success);
        unmount('layout');
        expect(operation.mock.calls[0][1]()).toBe(false);
        const calls = mocks.setters.mock.calls.length;
        if (outcome === 'resolve') pending.resolve({ message: 'Old' }); else pending.reject(new Error('Old'));
        await run;
        expect(mocks.setters).toHaveBeenCalledTimes(calls);
        expect(success).not.toHaveBeenCalled();
    });

    it('reports current failure and allows recovery without retaining its lock', async () => {
        await render().runExport('failed', () => Promise.reject(new Error('Permission denied')));
        expect(render()).toMatchObject({ isExporting: false, message: 'Permission denied' });
        await render().runExport('next', () => Promise.resolve({ message: 'Saved' }));
        expect(render()).toMatchObject({ isExporting: false, message: 'Saved' });
    });
});
