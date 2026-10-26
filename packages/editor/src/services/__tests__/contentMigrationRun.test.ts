import { describe, expect, it, vi } from 'vitest';

import type { ProjectState } from '../../store/project/types';
import type { ApplyContentMigrationPreviewResult, ContentMigrationPreviewResult } from '../contentMigrationPreview';

import { executeContentMigrationCommand } from '../contentMigrationCommand';
import { createContentMigrationRunner } from '../contentMigrationRun';

vi.mock('../../store/storeBootstrap', () => ({ useProjectStore: { getState: vi.fn() } }));
vi.mock('../../store/useEditorStore', () => ({ useEditorStore: { getState: vi.fn() } }));
vi.mock('../../store/actions/consoleMessageActions', () => ({ executeConsoleMessageAction: vi.fn() }));

function deferred<T>() {
    let resolve!: (value: T) => void;
    let reject!: (reason: Error) => void;
    const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
    return { promise, reject, resolve };
}

function fixture(dirty = false) {
    const project: Pick<ProjectState, 'dirtyFiles' | 'loadManifest' | 'projectGeneration' | 'projectPath' | 'saveAllDirtyFiles'> = {
        dirtyFiles: new Set(dirty ? ['/A/intro.json'] : []), loadManifest: vi.fn(() => Promise.resolve(true)), projectGeneration: 1, projectPath: '/A',
        saveAllDirtyFiles: vi.fn(() => { project.dirtyFiles.clear(); return Promise.resolve({ failed: [], saved: ['/A/intro.json'], skipped: [] }); }),
    };
    const preview: ContentMigrationPreviewResult = {
        changes: [{ after: 'new', before: 'old', path: '/A/game.json', type: 'manifest' }], manifestPath: '/A/game.json', projectPath: '/A',
    };
    const application = { conflicts: [], skipped: [], written: preview.changes };
    const build = vi.fn(() => Promise.resolve(preview));
    const confirm = vi.fn<() => boolean | Promise<boolean>>(() => true);
    const apply = vi.fn<() => Promise<ApplyContentMigrationPreviewResult>>(() => Promise.resolve(application));
    const log = vi.fn();
    const announce = vi.fn();
    const markManualSave = vi.fn();
    const execute = vi.fn((path: string, isCurrent: () => boolean) => executeContentMigrationCommand(path, { applyPreview: apply, confirm, log, preview: build }, isCurrent));
    const runner = createContentMigrationRunner({ announce, execute, getProject: () => project, markManualSave });
    const session = () => ({ projectGeneration: project.projectGeneration, projectPath: project.projectPath });
    const replace = (path?: string) => { project.projectPath = path; project.projectGeneration++; project.dirtyFiles = new Set(); };
    return { announce, application, apply, build, confirm, execute, log, markManualSave, preview, project, replace, runner, session };
}

async function outcome(promise: Promise<{ status: string }>) {
    const result = await promise;
    return result.status;
}

describe('content migration run ownership', () => {
    it.each([false, true])('migrates current saved content and refreshes with dirty=%s', async dirty => {
        const f = fixture(dirty);
        expect(await outcome(f.runner.runSaved(f.session()))).toBe('applied');
        expect(f.project.saveAllDirtyFiles).toHaveBeenCalledTimes(dirty ? 1 : 0);
        expect(f.markManualSave).toHaveBeenCalledTimes(dirty ? 1 : 0);
        expect(f.project.loadManifest).toHaveBeenCalledOnce();
        expect(f.announce).toHaveBeenLastCalledWith('Content migration applied 1 file(s).', 'success');
    });

    it.each(['failed', 'remaining', 'new-edit', 'throw'] as const)('blocks preview and writes on %s save', async mode => {
        const f = fixture(true);
        f.project.saveAllDirtyFiles = vi.fn(() => {
            if (mode === 'throw') throw new Error('Save conflict');
            if (mode === 'failed') f.project.dirtyFiles.clear();
            if (mode === 'new-edit') f.project.dirtyFiles = new Set(['/A/new.json']);
            return Promise.resolve({ failed: mode === 'failed' ? ['/A/intro.json'] : [], saved: [], skipped: [] });
        });
        expect(await outcome(f.runner.runSaved(f.session()))).toBe('save-cancelled');
        expect(f.build).not.toHaveBeenCalled();
        expect(f.apply).not.toHaveBeenCalled();
        expect(f.project.loadManifest).not.toHaveBeenCalled();
    });

    it.each(['save', 'preview', 'confirm', 'apply', 'reload'] as const)('retires a pending %s across replacement without successor publication', async stage => {
        const f = fixture(stage === 'save');
        const gate = deferred<never>();
        if (stage === 'save') f.project.saveAllDirtyFiles = vi.fn(() => gate.promise);
        if (stage === 'preview') f.build.mockReturnValueOnce(gate.promise);
        if (stage === 'confirm') f.confirm.mockReturnValueOnce(gate.promise);
        if (stage === 'apply') f.apply.mockReturnValueOnce(gate.promise);
        if (stage === 'reload') f.project.loadManifest = vi.fn(() => gate.promise);
        const pending = f.runner.runSaved(f.session());
        await vi.waitFor(() => {
            if (stage === 'save') expect(f.project.saveAllDirtyFiles).toHaveBeenCalledOnce();
            if (stage === 'preview') expect(f.build).toHaveBeenCalledOnce();
            if (stage === 'confirm') expect(f.confirm).toHaveBeenCalledOnce();
            if (stage === 'apply') expect(f.apply).toHaveBeenCalledOnce();
            if (stage === 'reload') expect(f.project.loadManifest).toHaveBeenCalledOnce();
        });
        const logs = f.log.mock.calls.length;
        const statuses = f.announce.mock.calls.length;
        f.replace('/B');
        gate.reject(new Error('Obsolete failure'));
        expect(await outcome(pending)).toBe('retired');
        expect(f.log).toHaveBeenCalledTimes(logs);
        expect(f.announce).toHaveBeenCalledTimes(statuses);
            if (['confirm', 'preview', 'save'].includes(stage)) expect(f.apply).not.toHaveBeenCalled();
        if (stage !== 'reload') expect(f.project.loadManifest).not.toHaveBeenCalled();
    });

    it.each(['A', 'B-A', 'closed'] as const)('retires confirmation across %s replacement', async destination => {
        const f = fixture();
        const gate = deferred<boolean>();
        f.confirm.mockReturnValueOnce(gate.promise);
        const pending = f.runner.runSaved(f.session());
        await vi.waitFor(() => expect(f.confirm).toHaveBeenCalledOnce());
        f.replace(destination === 'closed' ? undefined : '/A');
        if (destination === 'B-A') { f.replace('/B'); f.replace('/A'); }
        gate.resolve(true);
        expect(await outcome(pending)).toBe('retired');
        expect(f.apply).not.toHaveBeenCalled();
    });

    it.each(['manual-first', 'open-first'] as const)('shares ownership across both entry modes: %s', async order => {
        const f = fixture();
        const gate = deferred<ContentMigrationPreviewResult>();
        f.build.mockReturnValueOnce(gate.promise);
        const old = order === 'manual-first' ? f.runner.runSaved(f.session()) : f.runner.runForOpen('/B', () => true);
        const current = order === 'manual-first' ? f.runner.runForOpen('/B', () => true) : f.runner.runSaved(f.session());
        expect(await outcome(old)).toBe('retired');
        expect(await outcome(current)).toBe('applied');
        gate.resolve(f.preview);
        await Promise.resolve();
        expect(f.apply).toHaveBeenCalledOnce();
        expect(f.project.loadManifest).toHaveBeenCalledTimes(order === 'open-first' ? 1 : 0);
    });

    it('does not let an obsolete rendered action supersede a current confirmation', async () => {
        const f = fixture();
        const oldSession = f.session();
        f.replace('/B');
        const gate = deferred<boolean>();
        f.confirm.mockReturnValueOnce(gate.promise);
        const current = f.runner.runSaved(f.session());
        expect(await outcome(f.runner.runSaved(oldSession))).toBe('retired');
        gate.resolve(true);
        expect(await outcome(current)).toBe('applied');
    });

    it('cancels newly dirty content after preview without applying or refreshing', async () => {
        const f = fixture();
        const gate = deferred<boolean>();
        f.confirm.mockReturnValueOnce(gate.promise);
        const pending = f.runner.runSaved(f.session());
        await vi.waitFor(() => expect(f.confirm).toHaveBeenCalledOnce());
        f.project.dirtyFiles.add('/A/intro.json');
        gate.resolve(true);
        expect(await outcome(pending)).toBe('save-cancelled');
        expect(f.apply).not.toHaveBeenCalled();
        expect(f.project.loadManifest).not.toHaveBeenCalled();
    });

    it('reports partial progress and refreshes after a current write failure', async () => {
        const f = fixture();
        f.apply.mockResolvedValueOnce({ ...f.application, failures: [{ change: f.preview.changes[0], message: 'Read-only scene' }] });
        expect(await outcome(f.runner.runSaved(f.session()))).toBe('failed');
        expect(f.project.loadManifest).toHaveBeenCalledOnce();
        expect(f.announce).toHaveBeenLastCalledWith(expect.stringContaining('writing 1 file(s)'), 'error');
    });

    it('reports refresh failure while retaining written progress', async () => {
        const f = fixture();
        f.project.loadManifest = vi.fn(() => Promise.resolve(false));
        expect(await outcome(f.runner.runSaved(f.session()))).toBe('applied');
        expect(f.announce).toHaveBeenLastCalledWith(expect.stringContaining('could not be refreshed'), 'warning');
    });

    it('refreshes current content after zero-written conflicts from an earlier owner', async () => {
        const f = fixture();
        f.apply.mockResolvedValueOnce({ conflicts: f.preview.changes, skipped: [], written: [] });
        expect(await outcome(f.runner.runSaved(f.session()))).toBe('conflicted');
        expect(f.project.loadManifest).toHaveBeenCalledOnce();
    });

    it('lets automatic opening retain its migration-error continuation policy', async () => {
        const f = fixture();
        f.build.mockRejectedValueOnce(new Error('Invalid migration source'));
        await expect(f.runner.runForOpen('/B', () => true)).rejects.toThrow('Invalid migration source');
        expect(f.announce).not.toHaveBeenCalled();
    });

    it('retires automatic opening before preview when its lease is obsolete', async () => {
        const f = fixture();
        expect(await outcome(f.runner.runForOpen('/B', () => false))).toBe('retired');
        expect(f.build).not.toHaveBeenCalled();
    });

    it('does not save unrelated drafts during automatic migration of a new project', async () => {
        const f = fixture(true);
        expect(await outcome(f.runner.runForOpen('/B', () => true))).toBe('applied');
        expect(f.project.saveAllDirtyFiles).not.toHaveBeenCalled();
        expect(f.project.dirtyFiles.size).toBe(1);
        expect(f.project.loadManifest).not.toHaveBeenCalled();
    });
});
