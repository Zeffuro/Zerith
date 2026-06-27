import { beforeEach, describe, expect, it, vi } from 'vitest';

const storeMocks = vi.hoisted(() => {
    const projectState = {
        dirtyFiles: new Set<string>(),
        openProjectFromManifest: vi.fn<(manifestPath: string) => Promise<void>>(),
        projectPath: undefined as string | undefined,
        saveAllDirtyFiles: vi.fn(() => Promise.resolve({
            failed: [] as string[],
            saved: [] as string[],
            skipped: [] as string[],
        })),
        setProject: vi.fn(),
    };
    const editorState = {
        markManualSave: vi.fn(),
        requestProjectClose: vi.fn(),
        setSelectedAssetPath: vi.fn(),
    };
    const workbenchState = {
        clearTabs: vi.fn(),
    };

    return {
        editorState,
        projectState,
        workbenchState,
    };
});

const serviceMocks = vi.hoisted(() => ({
    chooseProjectOpenTarget: vi.fn<() => Promise<'cancel' | 'current' | 'new-window'>>(() => Promise.resolve('current')),
    confirmEditorAction: vi.fn(() => Promise.resolve(true)),
    executeContentMigrationCommand: vi.fn(() => Promise.resolve({ status: 'no-changes' })),
    isTauriRuntime: vi.fn(() => false),
    openProjectInNewEditorWindow: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../storeBootstrap', () => ({
    useProjectStore: {
        getState: () => storeMocks.projectState,
    },
    useScriptStore: {
        getState: () => ({
            setScript: vi.fn(),
        }),
    },
}));

vi.mock('../../useEditorStore', () => ({
    useEditorStore: {
        getState: () => storeMocks.editorState,
    },
}));

vi.mock('../../useWorkbenchStore', () => ({
    useWorkbenchStore: {
        getState: () => storeMocks.workbenchState,
    },
}));

vi.mock('../../../services/contentMigrationCommand', () => ({
    executeContentMigrationCommand: serviceMocks.executeContentMigrationCommand,
}));

vi.mock('../../../services/editorDialogs', () => ({
    chooseProjectOpenTarget: serviceMocks.chooseProjectOpenTarget,
    confirmEditorAction: serviceMocks.confirmEditorAction,
}));

vi.mock('../../../services/runtime/runtimeEnvironment', () => ({
    isTauriRuntime: serviceMocks.isTauriRuntime,
}));

vi.mock('../../../services/runtime/windowControls', () => ({
    openProjectInNewEditorWindow: serviceMocks.openProjectInNewEditorWindow,
}));

import { executeOpenProjectInCurrentWindow } from '../projectOpenActions';

describe('projectOpenActions', () => {
    beforeEach(() => {
        storeMocks.projectState.dirtyFiles = new Set();
        storeMocks.projectState.projectPath = undefined;
        storeMocks.projectState.openProjectFromManifest.mockReset();
        storeMocks.projectState.saveAllDirtyFiles.mockReset();
        storeMocks.projectState.saveAllDirtyFiles.mockImplementation(() => Promise.resolve({
            failed: [] as string[],
            saved: [] as string[],
            skipped: [] as string[],
        }));
        storeMocks.projectState.setProject.mockReset();
        storeMocks.editorState.markManualSave.mockReset();
        storeMocks.editorState.requestProjectClose.mockReset();
        storeMocks.editorState.setSelectedAssetPath.mockReset();
        storeMocks.workbenchState.clearTabs.mockReset();
        serviceMocks.chooseProjectOpenTarget.mockReset();
        serviceMocks.chooseProjectOpenTarget.mockResolvedValue('current');
        serviceMocks.confirmEditorAction.mockReset();
        serviceMocks.confirmEditorAction.mockResolvedValue(true);
        serviceMocks.executeContentMigrationCommand.mockReset();
        serviceMocks.executeContentMigrationCommand.mockImplementation(() => Promise.resolve({ status: 'no-changes' }));
        serviceMocks.isTauriRuntime.mockReset();
        serviceMocks.isTauriRuntime.mockReturnValue(false);
        serviceMocks.openProjectInNewEditorWindow.mockReset();
        serviceMocks.openProjectInNewEditorWindow.mockImplementation(() => Promise.resolve());
        vi.unstubAllGlobals();
    });

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
        expect(storeMocks.projectState.openProjectFromManifest).toHaveBeenCalledWith('/next/game.json');
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
    });

    it('can switch without prompting after a command already saved explicitly', async () => {
        storeMocks.projectState.projectPath = '/current';

        const opened = await executeOpenProjectInCurrentWindow('/copy/game.json', { prompt: false });

        expect(opened).toEqual({ status: 'opened-current' });
        expect(serviceMocks.confirmEditorAction).not.toHaveBeenCalled();
        expect(serviceMocks.executeContentMigrationCommand).toHaveBeenCalledWith('/copy');
        expect(storeMocks.workbenchState.clearTabs).toHaveBeenCalledTimes(1);
        expect(storeMocks.projectState.openProjectFromManifest).toHaveBeenCalledWith('/copy/game.json');
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
    });
});
