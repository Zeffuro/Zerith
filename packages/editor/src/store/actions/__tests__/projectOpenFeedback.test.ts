import { beforeEach, describe, expect, it, vi } from 'vitest';

import './projectOpenActions.test-utilities';
import { beginProjectOpenRequest, closeProject, executeOpenProjectInCurrentWindow } from '../projectOpenActions';
import { resetProjectOpenMocks, serviceMocks, storeMocks } from './projectOpenActions.test-utilities';

type Takeover = 'closed' | 'newer-request' | 'other-session';

const takeovers: Takeover[] = ['newer-request', 'other-session', 'closed'];
const refreshError = 'Could not refresh project. Your open files and unsaved edits have been kept. Check game.json and its referenced files, then try again.';

function deferred<T>() {
    let resolve!: (value: T) => void;
    let reject!: (error: Error) => void;
    const promise = new Promise<T>((onResolve, onReject) => {
        resolve = onResolve;
        reject = onReject;
    });
    return { promise, reject, resolve };
}

function expectSession(snapshot: ReturnType<typeof sessionSnapshot>) {
    expect(storeMocks.projectState.projectPath).toBe(snapshot.projectPath);
    expect(storeMocks.projectState.projectGeneration).toBe(snapshot.projectGeneration);
    expect(storeMocks.projectState.manifest).toBe(snapshot.manifest);
    expect(storeMocks.projectState.dirtyFiles).toBe(snapshot.dirtyFiles);
}

function retainSession() {
    storeMocks.projectState.projectPath = '/current';
    storeMocks.projectState.manifest = { title: 'Unsaved project' };
    storeMocks.projectState.dirtyFiles = new Set(['/current/intro.json']);
    return sessionSnapshot();
}

function sessionSnapshot() {
    const { dirtyFiles, manifest, projectGeneration, projectPath } = storeMocks.projectState;
    return { dirtyFiles, manifest, projectGeneration, projectPath };
}

function takeOver(mode: Takeover) {
    if (mode === 'newer-request') beginProjectOpenRequest();
    else if (mode === 'closed') closeProject();
    else {
        storeMocks.projectState.projectPath = '/other';
        storeMocks.projectState.projectGeneration++;
    }
    return sessionSnapshot();
}

describe('project open failure feedback ownership', () => {
    beforeEach(resetProjectOpenMocks);

    it.each([false, true])('reports a recoverable current refresh failure without changing the session (desktop: %s)', async desktop => {
        serviceMocks.isTauriRuntime.mockReturnValue(desktop);
        const retained = retainSession();
        storeMocks.projectState.loadManifest.mockResolvedValue(false);

        expect(await executeOpenProjectInCurrentWindow('/current/game.json', { checkMigration: false })).toEqual({ status: 'cancelled' });

        expectSession(retained);
        expect(storeMocks.editorState.announceOperationStatus).toHaveBeenCalledExactlyOnceWith(refreshError, 'error');
        expect(storeMocks.projectState.openProjectFromManifest).not.toHaveBeenCalled();
        expect(storeMocks.projectState.saveAllDirtyFiles).not.toHaveBeenCalled();
        expect(storeMocks.workbenchState.clearTabs).not.toHaveBeenCalled();
        expect(serviceMocks.rememberProject).not.toHaveBeenCalled();
    });

    describe.each([false, true])('refresh completion (desktop: %s)', desktop => {
        it.each(takeovers)('suppresses a failed refresh after %s takes ownership', async mode => {
            serviceMocks.isTauriRuntime.mockReturnValue(desktop);
            retainSession();
            const refresh = deferred<boolean>();
            storeMocks.projectState.loadManifest.mockReturnValueOnce(refresh.promise);
            const opening = executeOpenProjectInCurrentWindow('/current/game.json', { checkMigration: false });
            await vi.waitFor(() => expect(storeMocks.projectState.loadManifest).toHaveBeenCalledTimes(1));

            const retained = takeOver(mode);
            refresh.resolve(false);

            expect(await opening).toEqual({ status: 'cancelled' });
            expectSession(retained);
            expect(storeMocks.editorState.announceOperationStatus).not.toHaveBeenCalled();
            expect(serviceMocks.rememberProject).not.toHaveBeenCalled();
        });

        it('keeps successful refreshes silent and preserves unsaved edits', async () => {
            serviceMocks.isTauriRuntime.mockReturnValue(desktop);
            const retained = retainSession();

            expect(await executeOpenProjectInCurrentWindow('/current/game.json', { checkMigration: false })).toEqual({ status: 'opened-current' });

            expectSession(retained);
            expect(storeMocks.projectState.loadManifest).toHaveBeenCalledTimes(1);
            expect(storeMocks.editorState.announceOperationStatus).not.toHaveBeenCalled();
            expect(storeMocks.projectState.saveAllDirtyFiles).not.toHaveBeenCalled();
            expect(storeMocks.workbenchState.clearTabs).not.toHaveBeenCalled();
            if (desktop) expect(serviceMocks.rememberProject).not.toHaveBeenCalled();
            else expect(serviceMocks.rememberProject).toHaveBeenCalledExactlyOnceWith('/current/game.json');
        });

        it('does not announce a failed earlier refresh after a newer same-folder refresh succeeds', async () => {
            serviceMocks.isTauriRuntime.mockReturnValue(desktop);
            const retained = retainSession();
            const refresh = deferred<boolean>();
            storeMocks.projectState.loadManifest.mockReturnValueOnce(refresh.promise);
            const earlier = executeOpenProjectInCurrentWindow('/current/game.json', { checkMigration: false });
            await vi.waitFor(() => expect(storeMocks.projectState.loadManifest).toHaveBeenCalledTimes(1));

            expect(await executeOpenProjectInCurrentWindow('/current/game.json', { checkMigration: false })).toEqual({ status: 'opened-current' });
            refresh.resolve(false);

            expect(await earlier).toEqual({ status: 'cancelled' });
            expectSession(retained);
            expect(storeMocks.editorState.announceOperationStatus).not.toHaveBeenCalled();
            expect(serviceMocks.rememberProject).toHaveBeenCalledTimes(desktop ? 0 : 1);
        });
    });

    it.each(takeovers)('suppresses a rejected browser preflight after %s takes ownership', async mode => {
        retainSession();
        const preflight = deferred<void>();
        serviceMocks.prepareProject.mockReturnValueOnce(preflight.promise);
        const opening = executeOpenProjectInCurrentWindow('/next/game.json', { checkMigration: false });
        await vi.waitFor(() => expect(serviceMocks.prepareProject).toHaveBeenCalledTimes(1));

        const retained = takeOver(mode);
        preflight.reject(new Error('Folder access expired'));

        expect(await opening).toEqual({ status: 'cancelled' });
        expectSession(retained);
        expect(storeMocks.editorState.announceOperationStatus).not.toHaveBeenCalled();
        expect(serviceMocks.stageProject).not.toHaveBeenCalled();
        expect(storeMocks.projectState.saveAllDirtyFiles).not.toHaveBeenCalled();
        expect(serviceMocks.rememberProject).not.toHaveBeenCalled();
    });

    describe.each([false, true])('destination staging feedback (desktop: %s)', desktop => {
        it.each(takeovers)('suppresses staging failure after %s takes ownership', async mode => {
            serviceMocks.isTauriRuntime.mockReturnValue(desktop);
            retainSession();
            const staging = deferred<Awaited<ReturnType<typeof serviceMocks.stageProject>>>();
            serviceMocks.stageProject.mockReturnValueOnce(staging.promise);
            const opening = executeOpenProjectInCurrentWindow('/next/game.json', { checkMigration: false, prompt: false });
            await vi.waitFor(() => expect(serviceMocks.stageProject).toHaveBeenCalledTimes(1));

            const retained = takeOver(mode);
            staging.reject(new Error('Referenced scene is unreadable'));

            expect(await opening).toEqual({ status: 'cancelled' });
            expectSession(retained);
            expect(storeMocks.editorState.announceOperationStatus).not.toHaveBeenCalled();
            expect(storeMocks.projectState.openProjectFromManifest).not.toHaveBeenCalled();
            expect(storeMocks.projectState.saveAllDirtyFiles).not.toHaveBeenCalled();
            expect(serviceMocks.rememberProject).not.toHaveBeenCalled();
        });
    });

    describe.each(['/current', '/next'])('browser recency feedback for %s', destination => {
        it.each(takeovers)('suppresses storage failure after %s takes ownership', async mode => {
            retainSession();
            const storage = deferred<void>();
            serviceMocks.rememberProject.mockReturnValueOnce(storage.promise);
            storeMocks.projectState.dirtyFiles = new Set();
            const opening = executeOpenProjectInCurrentWindow(`${destination}/game.json`, { checkMigration: false, prompt: false });
            await vi.waitFor(() => expect(serviceMocks.rememberProject).toHaveBeenCalledTimes(1));

            const retained = takeOver(mode);
            storage.reject(new Error('Storage unavailable'));

            expect(await opening).toEqual({ status: 'cancelled' });
            expectSession(retained);
            expect(storeMocks.editorState.announceOperationStatus).not.toHaveBeenCalled();
        });

        it('warns about current storage failure while retaining the opened project', async () => {
            retainSession();
            storeMocks.projectState.dirtyFiles = new Set();
            serviceMocks.rememberProject.mockRejectedValueOnce(new Error('Storage unavailable'));

            expect(await executeOpenProjectInCurrentWindow(`${destination}/game.json`, { checkMigration: false, prompt: false })).toEqual({ status: 'opened-current' });

            expect(storeMocks.projectState.projectPath).toBe(destination);
            expect(storeMocks.editorState.announceOperationStatus).toHaveBeenCalledExactlyOnceWith(
                'Project opened, but this browser could not remember its folder.', 'warning',
            );
        });
    });

    describe.each([false, true])('migration failure feedback (desktop: %s)', desktop => {
        it.each(takeovers)('suppresses a migration failure after %s takes ownership', async mode => {
            serviceMocks.isTauriRuntime.mockReturnValue(desktop);
            retainSession();
            const migration = deferred<{ status: string }>();
            serviceMocks.executeContentMigrationCommand.mockReturnValueOnce(migration.promise);
            const alert = vi.fn();
            vi.stubGlobal('alert', alert);
            const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
            try {
                const opening = executeOpenProjectInCurrentWindow('/current/game.json');
                await vi.waitFor(() => expect(serviceMocks.executeContentMigrationCommand).toHaveBeenCalledTimes(1));
                const retained = takeOver(mode);
                migration.reject(new Error('Migration unavailable'));

                expect(await opening).toEqual({ status: 'cancelled' });
                expectSession(retained);
                expect(alert).not.toHaveBeenCalled();
                expect(consoleError).not.toHaveBeenCalled();
                expect(storeMocks.projectState.loadManifest).not.toHaveBeenCalled();
                expect(storeMocks.editorState.announceOperationStatus).not.toHaveBeenCalled();
            } finally {
                consoleError.mockRestore();
            }
        });

        it('reports a current migration failure and continues the refresh', async () => {
            serviceMocks.isTauriRuntime.mockReturnValue(desktop);
            const retained = retainSession();
            serviceMocks.executeContentMigrationCommand.mockRejectedValueOnce(new Error('Migration unavailable'));
            const alert = vi.fn();
            vi.stubGlobal('alert', alert);
            const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
            try {
                expect(await executeOpenProjectInCurrentWindow('/current/game.json')).toEqual({ status: 'opened-current' });

                expectSession(retained);
                expect(alert).toHaveBeenCalledExactlyOnceWith('Project migration check failed. Opening will continue.\n\nMigration unavailable');
                expect(consoleError).toHaveBeenCalledTimes(1);
                expect(storeMocks.projectState.loadManifest).toHaveBeenCalledTimes(1);
            } finally {
                consoleError.mockRestore();
            }
        });
    });

    it.each(takeovers)('suppresses a failed new-window open after %s takes ownership', async mode => {
        serviceMocks.isTauriRuntime.mockReturnValue(true);
        retainSession();
        serviceMocks.chooseProjectOpenTarget.mockResolvedValue('new-window');
        const newWindow = deferred<void>();
        serviceMocks.openProjectInNewEditorWindow.mockReturnValueOnce(newWindow.promise);
        const alert = vi.fn();
        vi.stubGlobal('alert', alert);
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
        try {
            const opening = executeOpenProjectInCurrentWindow('/next/game.json');
            await vi.waitFor(() => expect(serviceMocks.openProjectInNewEditorWindow).toHaveBeenCalledTimes(1));
            const retained = takeOver(mode);
            newWindow.reject(new Error('Window unavailable'));

            expect(await opening).toEqual({ status: 'cancelled' });
            expectSession(retained);
            expect(alert).not.toHaveBeenCalled();
            expect(consoleError).not.toHaveBeenCalled();
            expect(storeMocks.projectState.saveAllDirtyFiles).not.toHaveBeenCalled();
            expect(storeMocks.editorState.announceOperationStatus).not.toHaveBeenCalled();
        } finally {
            consoleError.mockRestore();
        }
    });

    it('reports a current new-window failure while preserving the current session', async () => {
        serviceMocks.isTauriRuntime.mockReturnValue(true);
        const retained = retainSession();
        serviceMocks.chooseProjectOpenTarget.mockResolvedValue('new-window');
        serviceMocks.openProjectInNewEditorWindow.mockRejectedValueOnce(new Error('Window unavailable'));
        const alert = vi.fn();
        vi.stubGlobal('alert', alert);
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
        try {
            expect(await executeOpenProjectInCurrentWindow('/next/game.json')).toEqual({ status: 'cancelled' });

            expectSession(retained);
            expect(alert).toHaveBeenCalledExactlyOnceWith('Failed to open project in a new editor window: Window unavailable');
            expect(consoleError).toHaveBeenCalledTimes(1);
            expect(storeMocks.workbenchState.clearTabs).not.toHaveBeenCalled();
        } finally {
            consoleError.mockRestore();
        }
    });
});
