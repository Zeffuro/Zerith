import { vi } from 'vitest';

const storeMocks = vi.hoisted(() => {
    const projectState = {
        dirtyFiles: new Set<string>(),
        loadManifest: vi.fn<() => Promise<boolean>>(() => Promise.resolve(true)),
        manifest: {} as object | undefined,
        openProjectFromManifest: vi.fn<(manifestPath: string) => Promise<boolean>>(() => Promise.resolve(true)),
        projectGeneration: 1,
        projectPath: undefined as string | undefined,
        saveAllDirtyFiles: vi.fn(() => Promise.resolve({
            failed: [] as string[],
            saved: [] as string[],
            skipped: [] as string[],
        })),
        setProject: vi.fn(),
    };
    const editorState = {
        announceOperationStatus: vi.fn(),
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
    executeContentMigrationCommand: vi.fn<() => Promise<{ application?: { written: string[] }; status: string }>>(() => Promise.resolve({ status: 'no-changes' })),
    isTauriRuntime: vi.fn(() => false),
    openProjectInNewEditorWindow: vi.fn(() => Promise.resolve()),
    prepareProject: vi.fn<(manifestPath: string) => Promise<void>>(() => Promise.resolve()),
    rememberProject: vi.fn<(manifestPath: string) => Promise<void>>(() => Promise.resolve()),
    stageProject: vi.fn((manifestPath: string) => Promise.resolve({
        files: [], manifestData: { title: 'Prepared' }, manifestPath,
        projectRoot: manifestPath.replaceAll('\\', '/').slice(0, manifestPath.replaceAll('\\', '/').lastIndexOf('/')),
    })),
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

vi.mock('../../../services/fs/browserFsAdapter', () => ({
    browserFsAdapter: {
        prepareProject: serviceMocks.prepareProject,
        recentProjects: { remember: serviceMocks.rememberProject },
    },
}));

vi.mock('../../../services/runtime/runtimeEnvironment', () => ({
    isTauriRuntime: serviceMocks.isTauriRuntime,
}));

vi.mock('../../../services/runtime/windowControls', () => ({
    openProjectInNewEditorWindow: serviceMocks.openProjectInNewEditorWindow,
}));

vi.mock('../../project/projectPreparation', async importOriginal => ({
    ...await importOriginal<typeof import('../../project/projectPreparation')>(),
    prepareProjectOpen: serviceMocks.stageProject,
}));

export { serviceMocks, storeMocks };

export function resetProjectOpenMocks(): void {
    storeMocks.projectState.dirtyFiles = new Set();
    storeMocks.projectState.projectPath = undefined;
    storeMocks.projectState.projectGeneration = 1;
    storeMocks.projectState.manifest = {};
    storeMocks.projectState.loadManifest.mockReset();
    storeMocks.projectState.loadManifest.mockResolvedValue(true);
    storeMocks.projectState.openProjectFromManifest.mockReset();
    storeMocks.projectState.openProjectFromManifest.mockImplementation(manifestPath => {
        storeMocks.projectState.projectPath = manifestPath.replaceAll('\\', '/').slice(0, manifestPath.replaceAll('\\', '/').lastIndexOf('/'));
        storeMocks.projectState.projectGeneration++;
        return Promise.resolve(true);
    });
    storeMocks.projectState.saveAllDirtyFiles.mockReset();
    storeMocks.projectState.saveAllDirtyFiles.mockImplementation(() => Promise.resolve({
        failed: [] as string[],
        saved: [] as string[],
        skipped: [] as string[],
    }));
    storeMocks.projectState.setProject.mockReset();
    storeMocks.projectState.setProject.mockImplementation((projectPath: string | undefined) => {
        storeMocks.projectState.projectPath = projectPath;
        storeMocks.projectState.projectGeneration++;
    });
    storeMocks.editorState.announceOperationStatus.mockReset();
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
    serviceMocks.prepareProject.mockReset();
    serviceMocks.prepareProject.mockResolvedValue();
    serviceMocks.rememberProject.mockReset();
    serviceMocks.rememberProject.mockResolvedValue();
    serviceMocks.stageProject.mockClear();
    serviceMocks.stageProject.mockImplementation(manifestPath => Promise.resolve({
        files: [], manifestData: { title: 'Prepared' }, manifestPath,
        projectRoot: manifestPath.replaceAll('\\', '/').slice(0, manifestPath.replaceAll('\\', '/').lastIndexOf('/')),
    }));
    vi.unstubAllGlobals();
}
