import { beforeEach, describe, expect, it, vi } from 'vitest';

import './projectOpenActions.test-utilities';
import { beginProjectOpenRequest, executeOpenProjectInCurrentWindow } from '../projectOpenActions';
import { resetProjectOpenMocks, serviceMocks, storeMocks } from './projectOpenActions.test-utilities';

describe('projectOpenActions', () => {
    beforeEach(resetProjectOpenMocks);

    it('prompts, saves dirty files, clears tabs, and opens another project', async () => {
        storeMocks.projectState.projectPath = '/current';
        storeMocks.projectState.dirtyFiles = new Set(['/current/scripts/intro.json']);
        storeMocks.projectState.saveAllDirtyFiles.mockImplementation(() => {
            storeMocks.projectState.dirtyFiles = new Set();
            return Promise.resolve({
                failed: [] as string[],
                saved: ['/current/scripts/intro.json'],
                skipped: [] as string[],
            });
        });
        const opened = await executeOpenProjectInCurrentWindow('/next/game.json');

        expect(opened).toEqual({ status: 'opened-current' });
        expect(serviceMocks.confirmEditorAction).toHaveBeenCalledTimes(1);
        expect(storeMocks.editorState.markManualSave).toHaveBeenCalledTimes(1);
        expect(storeMocks.projectState.saveAllDirtyFiles).toHaveBeenCalledTimes(1);
        expect(serviceMocks.executeContentMigrationCommand).toHaveBeenCalledWith('/next');
        expect(storeMocks.workbenchState.clearTabs).toHaveBeenCalledTimes(1);
        expect(storeMocks.projectState.openProjectFromManifest).toHaveBeenCalledWith('/next/game.json', expect.anything());
        expect(serviceMocks.prepareProject).toHaveBeenCalledWith('/next/game.json');
        expect(serviceMocks.rememberProject).toHaveBeenCalledWith('/next/game.json');
        expect(serviceMocks.prepareProject.mock.invocationCallOrder[0]).toBeLessThan(serviceMocks.confirmEditorAction.mock.invocationCallOrder[0]);
        expect(storeMocks.projectState.openProjectFromManifest.mock.invocationCallOrder[0]).toBeLessThan(serviceMocks.rememberProject.mock.invocationCallOrder[0]);
    });

    it('keeps the current project when the switch prompt is cancelled', async () => {
        storeMocks.projectState.projectPath = '/current';
        serviceMocks.confirmEditorAction.mockResolvedValue(false);

        const opened = await executeOpenProjectInCurrentWindow('/next/game.json');

        expect(opened).toEqual({ status: 'cancelled' });
        expect(serviceMocks.executeContentMigrationCommand).not.toHaveBeenCalled();
        expect(storeMocks.projectState.saveAllDirtyFiles).not.toHaveBeenCalled();
        expect(storeMocks.workbenchState.clearTabs).not.toHaveBeenCalled();
        expect(storeMocks.projectState.openProjectFromManifest).not.toHaveBeenCalled();
        expect(serviceMocks.rememberProject).not.toHaveBeenCalled();
    });

    it('can switch without prompting after a command already saved explicitly', async () => {
        storeMocks.projectState.projectPath = '/current';

        const opened = await executeOpenProjectInCurrentWindow('/copy/game.json', { prompt: false });

        expect(opened).toEqual({ status: 'opened-current' });
        expect(serviceMocks.confirmEditorAction).not.toHaveBeenCalled();
        expect(serviceMocks.executeContentMigrationCommand).toHaveBeenCalledWith('/copy');
        expect(storeMocks.workbenchState.clearTabs).toHaveBeenCalledTimes(1);
        expect(storeMocks.projectState.openProjectFromManifest).toHaveBeenCalledWith('/copy/game.json', expect.anything());
        expect(serviceMocks.rememberProject).toHaveBeenCalledWith('/copy/game.json');
    });

    it('opens another project in a new editor window without saving or clearing the current one', async () => {
        storeMocks.projectState.projectPath = '/current';
        storeMocks.projectState.dirtyFiles = new Set(['/current/scripts/intro.json']);
        serviceMocks.isTauriRuntime.mockReturnValue(true);
        serviceMocks.chooseProjectOpenTarget.mockResolvedValue('new-window');

        const opened = await executeOpenProjectInCurrentWindow('/next/game.json');

        expect(opened).toEqual({ status: 'opened-new-window' });
        expect(serviceMocks.chooseProjectOpenTarget).toHaveBeenCalledWith({
            currentProjectPath: '/current',
            dirtyCount: 1,
            nextProjectPath: '/next',
        });
        expect(serviceMocks.openProjectInNewEditorWindow).toHaveBeenCalledWith('/next/game.json');
        expect(serviceMocks.executeContentMigrationCommand).not.toHaveBeenCalled();
        expect(storeMocks.editorState.markManualSave).not.toHaveBeenCalled();
        expect(storeMocks.projectState.saveAllDirtyFiles).not.toHaveBeenCalled();
        expect(storeMocks.workbenchState.clearTabs).not.toHaveBeenCalled();
        expect(storeMocks.projectState.openProjectFromManifest).not.toHaveBeenCalled();
        expect(serviceMocks.prepareProject).not.toHaveBeenCalled();
        expect(serviceMocks.rememberProject).not.toHaveBeenCalled();
    });

    it.each([
        new DOMException('Folder access denied', 'NotAllowedError'),
        new DOMException('game.json is missing', 'NotFoundError'),
        new SyntaxError('Invalid project JSON'),
    ])('retains the current project and dirty tabs when browser preflight fails: %s', async (error) => {
        storeMocks.projectState.projectPath = '/current';
        const dirtyFiles = new Set(['/current/scripts/intro.json']);
        storeMocks.projectState.dirtyFiles = dirtyFiles;
        serviceMocks.prepareProject.mockRejectedValue(error);
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

        try {
            expect(await executeOpenProjectInCurrentWindow('/next/game.json')).toEqual({ status: 'cancelled' });

            expect(storeMocks.projectState.projectPath).toBe('/current');
            expect(storeMocks.projectState.dirtyFiles).toBe(dirtyFiles);
            expect(serviceMocks.confirmEditorAction).not.toHaveBeenCalled();
            expect(storeMocks.editorState.markManualSave).not.toHaveBeenCalled();
            expect(storeMocks.projectState.saveAllDirtyFiles).not.toHaveBeenCalled();
            expect(serviceMocks.executeContentMigrationCommand).not.toHaveBeenCalled();
            expect(storeMocks.workbenchState.clearTabs).not.toHaveBeenCalled();
            expect(storeMocks.projectState.openProjectFromManifest).not.toHaveBeenCalled();
            expect(serviceMocks.rememberProject).not.toHaveBeenCalled();
            expect(storeMocks.editorState.announceOperationStatus).toHaveBeenCalledWith(`Could not open project: ${error.message}`, 'error');
            expect(consoleError).not.toHaveBeenCalled();
        } finally {
            consoleError.mockRestore();
        }
    });

    it('does not open or remember when saving dirty files fails', async () => {
        storeMocks.projectState.projectPath = '/current';
        storeMocks.projectState.dirtyFiles = new Set(['/current/scripts/intro.json']);
        serviceMocks.confirmEditorAction.mockResolvedValue(true);
        storeMocks.projectState.saveAllDirtyFiles.mockResolvedValue({
            failed: ['/current/scripts/intro.json'], saved: [], skipped: [],
        });
        const alert = vi.fn();
        vi.stubGlobal('alert', alert);

        expect(await executeOpenProjectInCurrentWindow('/next/game.json')).toEqual({ status: 'cancelled' });
        expect(alert).toHaveBeenCalledTimes(1);
        expect(storeMocks.workbenchState.clearTabs).not.toHaveBeenCalled();
        expect(storeMocks.projectState.openProjectFromManifest).not.toHaveBeenCalled();
        expect(serviceMocks.rememberProject).not.toHaveBeenCalled();
    });

    it('keeps a successfully opened project when remembering its folder fails', async () => {
        serviceMocks.rememberProject.mockRejectedValue(new Error('Storage unavailable'));
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

        try {
            expect(await executeOpenProjectInCurrentWindow('/next/game.json')).toEqual({ status: 'opened-current' });
            expect(storeMocks.projectState.openProjectFromManifest).toHaveBeenCalledWith('/next/game.json', expect.anything());
            expect(storeMocks.editorState.announceOperationStatus).toHaveBeenCalledWith(
                'Project opened, but this browser could not remember its folder.', 'warning',
            );
            expect(consoleError).not.toHaveBeenCalled();
        } finally {
            consoleError.mockRestore();
        }
    });

    it('bypasses browser handles and storage for a desktop open in the current window', async () => {
        serviceMocks.isTauriRuntime.mockReturnValue(true);
        serviceMocks.prepareProject.mockRejectedValue(new Error('Browser unavailable'));
        serviceMocks.rememberProject.mockRejectedValue(new Error('Browser unavailable'));

        expect(await executeOpenProjectInCurrentWindow('/native/game.json')).toEqual({ status: 'opened-current' });
        expect(storeMocks.projectState.openProjectFromManifest).toHaveBeenCalledWith('/native/game.json', expect.anything());
        expect(serviceMocks.prepareProject).not.toHaveBeenCalled();
        expect(serviceMocks.rememberProject).not.toHaveBeenCalled();
        expect(storeMocks.editorState.announceOperationStatus).not.toHaveBeenCalled();
    });

    it.each([false, true])('retains dirty tabs when reopening the active folder (desktop: %s)', async desktop => {
        serviceMocks.isTauriRuntime.mockReturnValue(desktop);
        storeMocks.projectState.projectPath = '/current';
        const dirtyFiles = new Set(['/current/scripts/intro.json']);
        storeMocks.projectState.dirtyFiles = dirtyFiles;

        expect(await executeOpenProjectInCurrentWindow('/current/game.json')).toEqual({ status: 'opened-current' });
        expect(storeMocks.projectState.loadManifest).toHaveBeenCalledTimes(1);
        expect(storeMocks.projectState.openProjectFromManifest).not.toHaveBeenCalled();
        expect(storeMocks.projectState.dirtyFiles).toBe(dirtyFiles);
        expect(storeMocks.workbenchState.clearTabs).not.toHaveBeenCalled();
        expect(storeMocks.projectState.saveAllDirtyFiles).not.toHaveBeenCalled();
        if (desktop) expect(serviceMocks.rememberProject).not.toHaveBeenCalled();
        else expect(serviceMocks.rememberProject).toHaveBeenCalledWith('/current/game.json');
    });

    it('does not clear tabs or remember a browser open that reports failure', async () => {
        storeMocks.projectState.projectPath = '/current';
        storeMocks.projectState.openProjectFromManifest.mockResolvedValue(false);

        expect(await executeOpenProjectInCurrentWindow('/next/game.json')).toEqual({ status: 'cancelled' });
        expect(storeMocks.workbenchState.clearTabs).not.toHaveBeenCalled();
        expect(serviceMocks.rememberProject).not.toHaveBeenCalled();
        expect(storeMocks.editorState.announceOperationStatus).toHaveBeenCalledWith(expect.any(String), 'error');
    });

    it.each([false, true])('retains the active session when its manifest refresh fails (desktop: %s)', async desktop => {
        serviceMocks.isTauriRuntime.mockReturnValue(desktop);
        storeMocks.projectState.projectPath = '/current';
        const dirtyFiles = new Set(['/current/scripts/intro.json']);
        const manifest = { name: 'Current project' };
        storeMocks.projectState.dirtyFiles = dirtyFiles;
        storeMocks.projectState.manifest = manifest;
        storeMocks.projectState.loadManifest.mockResolvedValue(false);

        expect(await executeOpenProjectInCurrentWindow('/current/game.json')).toEqual({ status: 'cancelled' });
        expect(storeMocks.projectState.projectPath).toBe('/current');
        expect(storeMocks.projectState.manifest).toBe(manifest);
        expect(storeMocks.projectState.dirtyFiles).toBe(dirtyFiles);
        expect(storeMocks.projectState.loadManifest).toHaveBeenCalledTimes(1);
        expect(storeMocks.projectState.openProjectFromManifest).not.toHaveBeenCalled();
        expect(storeMocks.projectState.saveAllDirtyFiles).not.toHaveBeenCalled();
        expect(storeMocks.workbenchState.clearTabs).not.toHaveBeenCalled();
        expect(serviceMocks.rememberProject).not.toHaveBeenCalled();
    });

    it.each([false, true])('switches between case-distinct POSIX folders (desktop: %s)', async desktop => {
        serviceMocks.isTauriRuntime.mockReturnValue(desktop);
        storeMocks.projectState.projectPath = '/Parent/Game';
        expect(await executeOpenProjectInCurrentWindow('/Parent/game/game.json', { prompt: false })).toEqual({ status: 'opened-current' });
        expect(storeMocks.projectState.openProjectFromManifest).toHaveBeenCalledWith('/Parent/game/game.json', expect.anything());
        expect(storeMocks.projectState.loadManifest).not.toHaveBeenCalled();
    });

    it.each([
        ['F:/Projects/Game', 'f:/projects/GAME/game.json'],
        [String.raw`\\server\share\Game`, String.raw`\\SERVER\SHARE\GAME\game.json`],
    ])('reloads the same Windows drive or UNC folder despite case differences: %s', async (current, selected) => {
        serviceMocks.isTauriRuntime.mockReturnValue(true);
        storeMocks.projectState.projectPath = current;
        expect(await executeOpenProjectInCurrentWindow(selected)).toEqual({ status: 'opened-current' });
        expect(storeMocks.projectState.loadManifest).toHaveBeenCalledTimes(1);
        expect(storeMocks.projectState.openProjectFromManifest).not.toHaveBeenCalled();
    });

    it.each([false, true])('keeps dirty files unsaved when destination staging fails (desktop: %s)', async desktop => {
        serviceMocks.isTauriRuntime.mockReturnValue(desktop);
        storeMocks.projectState.projectPath = '/current';
        const dirtyFiles = new Set(['/current/intro.json']);
        storeMocks.projectState.dirtyFiles = dirtyFiles;
        serviceMocks.stageProject.mockRejectedValueOnce(new Error('Required scene is missing'));

        expect(await executeOpenProjectInCurrentWindow('/next/game.json')).toEqual({ status: 'cancelled' });
        expect(storeMocks.projectState.projectPath).toBe('/current');
        expect(storeMocks.projectState.projectGeneration).toBe(1);
        expect(storeMocks.projectState.dirtyFiles).toBe(dirtyFiles);
        expect(storeMocks.editorState.markManualSave).not.toHaveBeenCalled();
        expect(storeMocks.projectState.saveAllDirtyFiles).not.toHaveBeenCalled();
        expect(storeMocks.projectState.openProjectFromManifest).not.toHaveBeenCalled();
        expect(storeMocks.workbenchState.clearTabs).not.toHaveBeenCalled();
        expect(serviceMocks.executeContentMigrationCommand).not.toHaveBeenCalled();
        expect(serviceMocks.rememberProject).not.toHaveBeenCalled();
        expect(storeMocks.editorState.announceOperationStatus).toHaveBeenCalledWith('Could not open project: Required scene is missing', 'error');
    });

    it('cancels a stale desktop decision after the current project changes', async () => {
        serviceMocks.isTauriRuntime.mockReturnValue(true);
        storeMocks.projectState.projectPath = '/current';
        let choose!: (choice: 'current') => void;
        serviceMocks.chooseProjectOpenTarget.mockReturnValueOnce(new Promise(resolve => { choose = resolve; }));
        const opening = executeOpenProjectInCurrentWindow('/next/game.json');
        storeMocks.projectState.projectPath = '/other';
        storeMocks.projectState.projectGeneration++;
        choose('current');
        expect(await opening).toEqual({ status: 'cancelled' });
        expect(serviceMocks.stageProject).not.toHaveBeenCalled();
        expect(storeMocks.projectState.openProjectFromManifest).not.toHaveBeenCalled();
    });

    it('does not activate an older staged project after a newer open finishes', async () => {
        serviceMocks.isTauriRuntime.mockReturnValue(true);
        storeMocks.projectState.projectPath = '/current';
        const old = await serviceMocks.stageProject('/older/game.json');
        serviceMocks.stageProject.mockClear();
        let finish!: (project: typeof old) => void;
        serviceMocks.stageProject.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
        const older = executeOpenProjectInCurrentWindow('/older/game.json', { checkMigration: false, prompt: false });
        await vi.waitFor(() => expect(serviceMocks.stageProject).toHaveBeenCalledTimes(1));
        expect(await executeOpenProjectInCurrentWindow('/newer/game.json', { checkMigration: false, prompt: false })).toEqual({ status: 'opened-current' });
        finish(old);
        expect(await older).toEqual({ status: 'cancelled' });
        expect(storeMocks.projectState.projectPath).toBe('/newer');
        expect(storeMocks.projectState.openProjectFromManifest).toHaveBeenCalledTimes(1);
        expect(storeMocks.workbenchState.clearTabs).toHaveBeenCalledTimes(1);
    });

    it('does not restart a stale request captured before permissions were restored', async () => {
        storeMocks.projectState.projectPath = '/current';
        const older = beginProjectOpenRequest();
        expect(await executeOpenProjectInCurrentWindow('/newer/game.json', { checkMigration: false, prompt: false })).toEqual({ status: 'opened-current' });
        const preparationCalls = serviceMocks.prepareProject.mock.calls.length;
        expect(await executeOpenProjectInCurrentWindow('/older/game.json', { request: older })).toEqual({ status: 'cancelled' });
        expect(serviceMocks.prepareProject).toHaveBeenCalledTimes(preparationCalls);
        expect(storeMocks.projectState.openProjectFromManifest).toHaveBeenCalledTimes(1);
        expect(storeMocks.projectState.projectPath).toBe('/newer');
    });

    it('opens a still-owned request captured before permission restoration', async () => {
        storeMocks.projectState.projectPath = '/current';
        const request = beginProjectOpenRequest();
        expect(await executeOpenProjectInCurrentWindow('/next/game.json', { checkMigration: false, prompt: false, request })).toEqual({ status: 'opened-current' });
        expect(storeMocks.projectState.projectPath).toBe('/next');
    });

    it('does not open the destination if another session takes over while saving', async () => {
        serviceMocks.isTauriRuntime.mockReturnValue(true);
        storeMocks.projectState.projectPath = '/current';
        storeMocks.projectState.dirtyFiles = new Set(['/current/intro.json']);
        storeMocks.projectState.saveAllDirtyFiles.mockImplementationOnce(() => {
            storeMocks.projectState.projectPath = '/other';
            storeMocks.projectState.projectGeneration++;
            return Promise.resolve({ failed: [], saved: ['/current/intro.json'], skipped: [] });
        });
        expect(await executeOpenProjectInCurrentWindow('/next/game.json')).toEqual({ status: 'cancelled' });
        expect(storeMocks.projectState.projectPath).toBe('/other');
        expect(storeMocks.projectState.openProjectFromManifest).not.toHaveBeenCalled();
        expect(storeMocks.workbenchState.clearTabs).not.toHaveBeenCalled();
    });

    it('restages migrated content before saving the active dirty session', async () => {
        serviceMocks.isTauriRuntime.mockReturnValue(true);
        storeMocks.projectState.projectPath = '/current';
        const dirtyFiles = new Set(['/current/intro.json']);
        storeMocks.projectState.dirtyFiles = dirtyFiles;
        serviceMocks.executeContentMigrationCommand.mockResolvedValueOnce({ application: { written: ['/next/intro.json'] }, status: 'applied' });
        serviceMocks.stageProject.mockImplementationOnce(path => Promise.resolve({ files: [], manifestData: { title: 'Before migration' }, manifestPath: path, projectRoot: '/next' }));
        serviceMocks.stageProject.mockRejectedValueOnce(new Error('Migrated scene is unreadable'));
        expect(await executeOpenProjectInCurrentWindow('/next/game.json')).toEqual({ status: 'cancelled' });
        expect(serviceMocks.stageProject).toHaveBeenCalledTimes(2);
        expect(storeMocks.projectState.dirtyFiles).toBe(dirtyFiles);
        expect(storeMocks.projectState.saveAllDirtyFiles).not.toHaveBeenCalled();
        expect(storeMocks.editorState.markManualSave).not.toHaveBeenCalled();
        expect(storeMocks.projectState.openProjectFromManifest).not.toHaveBeenCalled();
    });

    it('does not clear newer tabs when activation is superseded before the action resumes', async () => {
        serviceMocks.isTauriRuntime.mockReturnValue(true);
        storeMocks.projectState.projectPath = '/current';
        storeMocks.projectState.openProjectFromManifest.mockImplementationOnce(() => {
            storeMocks.projectState.projectPath = '/next';
            storeMocks.projectState.projectGeneration++;
            queueMicrotask(() => {
                storeMocks.projectState.projectPath = '/other';
                storeMocks.projectState.projectGeneration++;
            });
            return Promise.resolve(true);
        });
        expect(await executeOpenProjectInCurrentWindow('/next/game.json', { checkMigration: false })).toEqual({ status: 'cancelled' });
        expect(storeMocks.projectState.projectPath).toBe('/other');
        expect(storeMocks.workbenchState.clearTabs).not.toHaveBeenCalled();
        expect(serviceMocks.rememberProject).not.toHaveBeenCalled();
    });

    it('does not report an earlier browser open after another session takes over during recency storage', async () => {
        storeMocks.projectState.projectPath = '/current';
        serviceMocks.rememberProject.mockImplementationOnce(() => {
            storeMocks.projectState.projectPath = '/other';
            storeMocks.projectState.projectGeneration++;
            return Promise.resolve();
        });
        expect(await executeOpenProjectInCurrentWindow('/next/game.json', { checkMigration: false })).toEqual({ status: 'cancelled' });
        expect(storeMocks.projectState.projectPath).toBe('/other');
    });

    it('waits for a successful browser open before clearing old tabs and remembering it', async () => {
        storeMocks.projectState.projectPath = '/current';
        let finishOpen!: (opened: boolean) => void;
        storeMocks.projectState.openProjectFromManifest.mockImplementation(() => new Promise(resolve => { finishOpen = resolve; }));

        const opening = executeOpenProjectInCurrentWindow('/next/game.json');
        await vi.waitFor(() => { expect(storeMocks.projectState.openProjectFromManifest).toHaveBeenCalledTimes(1); });
        expect(storeMocks.workbenchState.clearTabs).not.toHaveBeenCalled();
        expect(serviceMocks.rememberProject).not.toHaveBeenCalled();

        finishOpen(true);
        storeMocks.projectState.projectPath = '/next';
        storeMocks.projectState.projectGeneration++;
        expect(await opening).toEqual({ status: 'opened-current' });
        expect(storeMocks.workbenchState.clearTabs).toHaveBeenCalledTimes(1);
        expect(serviceMocks.rememberProject).toHaveBeenCalledWith('/next/game.json');
    });
});
