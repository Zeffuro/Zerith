import { describe, expect, it, vi } from 'vitest';

import type { ProjectState, SaveAllResult } from '../../store/project/types';
import type { ProjectValidationReport } from '../projectValidationReport';

import { executeProjectValidationCommand } from '../projectValidationCommand';
import { createProjectValidationRunner } from '../projectValidationRun';

vi.mock('../../store/storeBootstrap', () => ({ useProjectStore: { getState: vi.fn() } }));
vi.mock('../../store/useEditorStore', () => ({ useEditorStore: { getState: vi.fn() } }));
vi.mock('../../store/actions/consoleMessageActions', () => ({ executeConsoleMessageAction: vi.fn() }));

function deferred<T>() {
    let resolve!: (value: T) => void;
    let reject!: (error: Error) => void;
    const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
    return { promise, reject, resolve };
}

function fixture(dirty = false) {
    const project: Pick<ProjectState, 'dirtyFiles' | 'projectGeneration' | 'projectPath' | 'saveAllDirtyFiles'> = {
        dirtyFiles: new Set(dirty ? ['/A/intro.json'] : []), projectGeneration: 1, projectPath: '/A',
        saveAllDirtyFiles: vi.fn<() => Promise<SaveAllResult>>(() => {
            project.dirtyFiles = new Set();
            return Promise.resolve({ failed: [], saved: ['/A/intro.json'], skipped: [] });
        }),
    };
    const cancel = vi.fn();
    const log = vi.fn();
    const markManualSave = vi.fn();
    const buildReport = vi.fn<(path: string) => Promise<ProjectValidationReport>>(path => Promise.resolve(report(path)));
    const execute = vi.fn((path: string, isCurrent: () => boolean) => executeProjectValidationCommand(path, { buildReport, log }, isCurrent));
    const run = createProjectValidationRunner({ cancel, execute, getProject: () => project, markManualSave });
    const session = () => ({ projectGeneration: project.projectGeneration, projectPath: project.projectPath });
    const replace = (path?: string) => { project.projectPath = path; project.projectGeneration++; project.dirtyFiles = new Set(); };
    return { buildReport, cancel, execute, log, markManualSave, project, replace, run, session };
}

function report(projectPath: string): ProjectValidationReport {
    return {
        backlog: { duplicateLineIds: [], entries: [], hiddenCount: 0, missingLineIds: [], visibleCount: 0, voicedCount: 0 },
        graph: { issues: [], labelReferences: [], labelsByScene: {}, reachableScenes: [], sceneEdges: [], unreachableScenes: [] },
        localization: { localeReports: [], referenceCount: 0, references: [] },
        manifest: {}, manifestPath: `${projectPath}/game.json`, projectPath, scenes: [],
    };
}

describe('saved project validation ownership', () => {
    it('keeps B after deferred A settles, including console publication', async () => {
        const f = fixture();
        const old = deferred<ProjectValidationReport>();
        f.buildReport.mockReturnValueOnce(old.promise);
        const pending = f.run(f.session());
        f.replace('/B');
        const current = await f.run(f.session());
        expect(current).toEqual({ report: report('/B'), status: 'ok' });
        old.resolve(report('/A'));
        expect(await pending).toEqual({ status: 'retired' });
        expect(f.log).toHaveBeenCalledOnce();
        expect(f.cancel).not.toHaveBeenCalled();
    });

    it.each([false, true])('validates current persisted data with dirty=%s', async dirty => {
        const f = fixture(dirty);
        expect(await f.run(f.session())).toEqual({ report: report('/A'), status: 'ok' });
        expect(f.markManualSave).toHaveBeenCalledTimes(dirty ? 1 : 0);
        expect(f.project.saveAllDirtyFiles).toHaveBeenCalledTimes(dirty ? 1 : 0);
        expect(f.log).toHaveBeenCalledOnce();
    });

    it.each(['failed', 'remaining', 'new-edit', 'throw'] as const)('cancels validation on %s save and preserves dirty files', async failure => {
        const f = fixture(true);
        const original = f.project.dirtyFiles;
        f.project.saveAllDirtyFiles = vi.fn(() => {
            if (failure === 'throw') throw new Error('Save conflict');
            if (failure === 'new-edit') f.project.dirtyFiles = new Set(['/A/new.json']);
            return Promise.resolve({ failed: failure === 'failed' ? ['/A/intro.json'] : [], saved: [], skipped: [] });
        });
        const result = await f.run(f.session());
        expect(result.status).toBe('cancelled');
        expect(f.execute).not.toHaveBeenCalled();
        expect(f.cancel).toHaveBeenCalledWith(expect.stringContaining(failure === 'throw' ? 'Save conflict' : 'not all dirty files'));
        expect(f.project.dirtyFiles).toEqual(failure === 'new-edit' ? new Set(['/A/new.json']) : original);
    });

    it('rejects an explicit failed save even if the dirty set is empty', async () => {
        const f = fixture(true);
        f.project.saveAllDirtyFiles = vi.fn(() => {
            f.project.dirtyFiles.clear();
            return Promise.resolve({ failed: ['/A/intro.json'], saved: [], skipped: [] });
        });
        const result = await f.run(f.session());
        expect(result.status).toBe('cancelled');
        expect(f.execute).not.toHaveBeenCalled();
    });

    it.each(['B', 'A', 'B-A', 'closed'] as const)('retires pending saves across %s replacement', async target => {
        const f = fixture(true);
        const save = deferred<SaveAllResult>();
        f.project.saveAllDirtyFiles = vi.fn(() => save.promise);
        const pending = f.run(f.session());
        f.replace(target === 'closed' ? undefined : (target === 'A' ? '/A' : '/B'));
        if (target === 'B-A') f.replace('/A');
        save.resolve({ failed: [], saved: ['/A/intro.json'], skipped: [] });
        expect(await pending).toEqual({ status: 'retired' });
        expect(f.execute).not.toHaveBeenCalled();
        expect(f.cancel).not.toHaveBeenCalled();
    });

    it.each(['report', 'save'] as const)('drops obsolete %s rejection', async stage => {
        const f = fixture(stage === 'save');
        const old = deferred<never>();
        if (stage === 'save') f.project.saveAllDirtyFiles = vi.fn(() => old.promise);
        else f.buildReport.mockReturnValueOnce(old.promise);
        const pending = f.run(f.session());
        f.replace('/B');
        old.reject(new Error('Old failure'));
        expect(await pending).toEqual({ status: 'retired' });
        expect(f.log).not.toHaveBeenCalled();
        expect(f.cancel).not.toHaveBeenCalled();
    });

    it('retains current report errors', async () => {
        const f = fixture();
        const error = new Error('Missing manifest');
        f.buildReport.mockRejectedValueOnce(error);
        expect(await f.run(f.session())).toEqual({ error, status: 'failed' });
        expect(f.log).toHaveBeenCalledWith('editor', 'error', 'Project validation failed:', error);
    });

    it('retires a run when its component owner unmounts', async () => {
        const f = fixture();
        const old = deferred<ProjectValidationReport>();
        f.buildReport.mockReturnValueOnce(old.promise);
        let active = true;
        const pending = f.run(f.session(), () => active);
        active = false;
        old.resolve(report('/A'));
        expect(await pending).toEqual({ status: 'retired' });
        expect(f.log).not.toHaveBeenCalled();
    });

    it('only the newest overlapping run publishes within the same session', async () => {
        const f = fixture();
        const old = deferred<ProjectValidationReport>();
        f.buildReport.mockReturnValueOnce(old.promise);
        const first = f.run(f.session());
        const result = await f.run(f.session());
        expect(result.status).toBe('ok');
        expect(await first).toEqual({ status: 'retired' });
        old.resolve(report('/A'));
        await Promise.resolve();
        expect(f.log).toHaveBeenCalledOnce();
    });

    it('suppresses a report and warns if edits arrive while it is reading files', async () => {
        const f = fixture();
        const pendingReport = deferred<ProjectValidationReport>();
        f.buildReport.mockReturnValueOnce(pendingReport.promise);
        const pending = f.run(f.session());
        f.project.dirtyFiles = new Set(['/A/intro.json']);
        pendingReport.resolve(report('/A'));
        const result = await pending;
        expect(result.status).toBe('cancelled');
        expect(f.log).not.toHaveBeenCalled();
        expect(f.cancel).toHaveBeenCalledWith(expect.stringContaining('files changed'));
        expect(f.project.dirtyFiles).toEqual(new Set(['/A/intro.json']));
    });

    it('does not let a stale action invalidate the current run', async () => {
        const f = fixture();
        const stale = f.session();
        f.replace('/B');
        const currentReport = deferred<ProjectValidationReport>();
        f.buildReport.mockReturnValueOnce(currentReport.promise);
        const pending = f.run(f.session());
        expect(await f.run(stale)).toEqual({ status: 'retired' });
        currentReport.resolve(report('/B'));
        const result = await pending;
        expect(result.status).toBe('ok');
        expect(f.log).toHaveBeenCalledOnce();
    });

    it('returns no-project without side effects', async () => {
        const f = fixture();
        f.replace();
        expect(await f.run(f.session())).toEqual({ status: 'no-project' });
        expect(f.execute).not.toHaveBeenCalled();
        expect(f.project.saveAllDirtyFiles).not.toHaveBeenCalled();
    });
});
