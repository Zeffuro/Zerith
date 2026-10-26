import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ExportGameOptions, ExportGameResult } from '../../services/exportGame';

const mocks = vi.hoisted(() => ({
    editor: { isExportGameModalOpen: true, markManualSave: vi.fn() },
    editorListeners: new Set<(current: { isExportGameModalOpen: boolean }, previous: { isExportGameModalOpen: boolean }) => void>(),
    effects: [] as (() => void)[],
    execute: vi.fn<(projectPath: string, options: ExportGameOptions, current: () => boolean) => Promise<ExportGameResult>>(),
    index: 0,
    native: false,
    picker: vi.fn(),
    project: { projectGeneration: 1, projectPath: '/A' },
    projectListeners: new Set<(current: { projectGeneration: number; projectPath: string | undefined }, previous: { projectGeneration: number; projectPath: string | undefined }) => void>(),
    save: vi.fn(),
    setters: vi.fn(),
    slots: [] as { cleanup?: () => void; value?: unknown }[],
}));
vi.mock('react', () => ({
    useEffect: (setup: () => () => void) => {
        const index = mocks.index++;
        if (!mocks.slots[index]) {
            const slot = mocks.slots[index] = {} as { cleanup?: () => void };
            mocks.effects.push(() => { slot.cleanup = setup(); });
        }
    },
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
}));
vi.mock('../../services/exportGame', () => ({ exportGame: mocks.execute }));
vi.mock('../../services/exportPreflight', () => ({ saveProjectBeforeExport: mocks.save }));
vi.mock('../../services/browserFolderExport', () => ({ pickBrowserFolderExportTarget: mocks.picker }));
vi.mock('../../services/runtime/runtimeEnvironment', () => ({ isTauriRuntime: () => mocks.native }));
vi.mock('../../store/storeBootstrap', () => ({ useProjectStore: {
    getState: () => mocks.project,
    subscribe: (listener: typeof mocks.projectListeners extends Set<infer T> ? T : never) => {
        mocks.projectListeners.add(listener);
        return () => mocks.projectListeners.delete(listener);
    },
} }));
vi.mock('../../store/useEditorStore', () => ({ useEditorStore: {
    getState: () => mocks.editor,
    subscribe: (listener: typeof mocks.editorListeners extends Set<infer T> ? T : never) => {
        mocks.editorListeners.add(listener);
        return () => mocks.editorListeners.delete(listener);
    },
} }));

import { useGameExport } from '../useGameExport';

function deferred<T>() {
    let resolve!: (value: T) => void;
    let reject!: (error: Error) => void;
    const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
    return { promise, reject, resolve };
}
function dialog(open: boolean) {
    const previous = { ...mocks.editor };
    mocks.editor.isExportGameModalOpen = open;
    for (const listener of mocks.editorListeners) listener(mocks.editor, previous);
}
function ExportSubject() { return useGameExport(); }
function project(path: string | undefined = '/A') {
    const previous = mocks.project;
    mocks.project = { projectGeneration: previous.projectGeneration + 1, projectPath: path };
    for (const listener of mocks.projectListeners) listener(mocks.project, previous);
}
function render() {
    mocks.index = 0;
    const view = ExportSubject();
    for (const effect of mocks.effects.splice(0)) effect();
    return view;
}
const result: ExportGameResult = { outDirectory: '/output', stderr: 'warning', stdout: 'Built current' };

describe('game export dialog ownership', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        vi.resetAllMocks();
        mocks.editor.isExportGameModalOpen = true;
        mocks.project = { projectGeneration: 1, projectPath: '/A' };
        mocks.native = false;
        mocks.effects.length = mocks.slots.length = 0;
        mocks.projectListeners.clear(); mocks.editorListeners.clear();
        mocks.save.mockImplementation(() => Promise.resolve());
        mocks.execute.mockResolvedValue(result);
        vi.spyOn(console, 'info').mockImplementation(() => {});
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    it('reports current success and rejects synchronous duplicate clicks', async () => {
        const view = render();
        const pending = view.runExport({});
        await view.runExport({});
        await pending;
        expect(mocks.execute).toHaveBeenCalledOnce();
        expect(render()).toMatchObject({ isExporting: false, statusMessage: 'Export complete. Your browser download is ready.' });
        expect(console.info).toHaveBeenCalledTimes(2);
        expect(console.warn).toHaveBeenCalledOnce();
    });

    it.each(['/B', '/A', undefined])('immediately retires a project replacement %j and drops late output', async path => {
        const pending = deferred<ExportGameResult>();
        mocks.execute.mockReturnValueOnce(pending.promise);
        const run = render().runExport({});
        await vi.waitFor(() => expect(mocks.execute).toHaveBeenCalledOnce());
        project(path);
        expect(render()).toMatchObject({ isExporting: false, statusMessage: 'The project changed. Start export again.' });
        expect(mocks.execute.mock.calls[0][2]()).toBe(false);
        const setters = mocks.setters.mock.calls.length;
        pending.resolve(result);
        await run;
        expect(mocks.setters).toHaveBeenCalledTimes(setters);
        expect(console.info).toHaveBeenCalledTimes(1);
        expect(console.warn).not.toHaveBeenCalled();
    });

    it.each(['resolve', 'reject'] as const)('close/reopen within one store turn cannot revive late %s', async outcome => {
        const pending = deferred<ExportGameResult>();
        mocks.execute.mockReturnValueOnce(pending.promise);
        const run = render().runExport({});
        await vi.waitFor(() => expect(mocks.execute).toHaveBeenCalledOnce());
        dialog(false); dialog(true);
        expect(render()).toMatchObject({ isExporting: false, statusMessage: undefined });
        const setters = mocks.setters.mock.calls.length;
        if (outcome === 'resolve') pending.resolve(result); else pending.reject(new Error('obsolete failure'));
        await run;
        expect(mocks.setters).toHaveBeenCalledTimes(setters);
        expect(console.error).not.toHaveBeenCalled();
    });

    it.each(['old-first', 'new-first'] as const)('keeps a successor state when %s completes', async order => {
        const old = deferred<ExportGameResult>();
        const next = deferred<ExportGameResult>();
        mocks.execute.mockReturnValueOnce(old.promise).mockReturnValueOnce(next.promise);
        const first = render().runExport({});
        await vi.waitFor(() => expect(mocks.execute).toHaveBeenCalledOnce());
        project();
        const second = render().runExport({});
        await vi.waitFor(() => expect(mocks.execute).toHaveBeenCalledTimes(2));
        if (order === 'new-first') { next.resolve(result); await second; }
        old.reject(new Error('obsolete failure')); await first;
        expect(render()).toMatchObject(order === 'old-first'
            ? { isExporting: true, statusMessage: 'Exporting game...' }
            : { isExporting: false, statusMessage: 'Export complete. Your browser download is ready.' });
        if (order === 'old-first') { next.resolve(result); await second; }
        expect(console.error).not.toHaveBeenCalled();
        expect(console.info).toHaveBeenCalledTimes(3);
    });

    it('does not dispatch or log after retirement during Save All', async () => {
        const saved = deferred<void>();
        mocks.save.mockReturnValueOnce(saved.promise);
        const run = render().runExport({});
        project('/B');
        saved.resolve(); await run;
        expect(mocks.execute).not.toHaveBeenCalled();
        expect(console.info).not.toHaveBeenCalled();
    });

    it('does not save after a replaced picker resolves or rejects', async () => {
        const picked = deferred<undefined>();
        mocks.picker.mockReturnValueOnce(picked.promise);
        const run = render().runExport({}, 'Published');
        project(); picked.reject(new Error('obsolete picker failure')); await run;
        expect(mocks.save).not.toHaveBeenCalled();
        expect(console.error).not.toHaveBeenCalled();
    });

    it('leaves source edits alone when the current picker is cancelled', async () => {
        mocks.picker.mockImplementationOnce(() => Promise.resolve());
        await render().runExport({}, 'Published');
        expect(render()).toMatchObject({ isExporting: false, statusMessage: 'Export cancelled.' });
        expect(mocks.save).not.toHaveBeenCalled();
        expect(mocks.editor.markManualSave).not.toHaveBeenCalled();
    });

    it('shows a current error and permits a subsequent export', async () => {
        mocks.execute.mockRejectedValueOnce(new Error('permission denied'));
        await render().runExport({});
        expect(render()).toMatchObject({ isExporting: false, statusMessage: 'Export failed: permission denied' });
        expect(console.error).toHaveBeenCalledOnce();
        await render().runExport({});
        expect(render().statusMessage).toContain('Export complete.');
    });

    it('drops a dispatched native result after unmount without setting state', async () => {
        mocks.native = true;
        const pending = deferred<ExportGameResult>();
        mocks.execute.mockReturnValueOnce(pending.promise);
        const run = render().runExport({ profile: 'desktop-tauri' });
        await vi.waitFor(() => expect(mocks.execute).toHaveBeenCalledOnce());
        for (const slot of mocks.slots) slot.cleanup?.();
        const setters = mocks.setters.mock.calls.length;
        pending.resolve(result); await run;
        expect(mocks.setters).toHaveBeenCalledTimes(setters);
        expect(console.info).toHaveBeenCalledTimes(1);
        expect(mocks.projectListeners.size).toBe(0);
        expect(mocks.editorListeners.size).toBe(0);
    });
});
