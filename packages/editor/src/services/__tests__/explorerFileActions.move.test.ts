import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ReferenceScannerResult } from '../referenceScanner';

const mocks = vi.hoisted(() => {
    const projectState = {
        activeFile: '/project/assets/bg/office.png',
        dirtyFiles: new Set<string>(),
        expandedPaths: ['/project/assets/bg'],
        loadManifest: vi.fn(() => Promise.resolve()),
        projectPath: '/project',
    };
    const referenceResult: ReferenceScannerResult = {
        assetFiles: {
            '/assets/bg/office.png': [
                {
                    commandType: 'background',
                    filePath: '/project/scenes/intro.json',
                    path: [0],
                    sceneName: 'intro',
                },
            ],
        },
        assets: {},
        characters: {},
        items: {},
        variables: {},
    };
    return {
        consoleMessage: vi.fn(),
        executeProjectTreeRefreshAction: vi.fn(),
        fsReadDirectory: vi.fn(() => Promise.resolve([])),
        fsReadTextFile: vi.fn(() => Promise.resolve(JSON.stringify({
            commands: [
                { assetUrl: '/assets/bg/office.png', type: 'background' },
            ],
        }))),
        fsRemove: vi.fn(() => Promise.resolve()),
        fsRename: vi.fn(() => Promise.resolve()),
        fsWriteTextFile: vi.fn(() => Promise.resolve()),
        projectState,
        referenceResult,
        refreshReferenceScannerState: vi.fn(() => Promise.resolve()),
        renameTabPath: vi.fn(),
        updateTabContent: vi.fn(),
        workbenchTabs: [] as Array<{
            id: string;
            kind: string;
            path: string;
            textContent?: string;
            title: string;
        }>,
    };
});

vi.mock('../../store/actions/consoleMessageActions', () => ({
    executeConsoleMessageAction: mocks.consoleMessage,
}));

vi.mock('../../store/actions/projectTreeActions', () => ({
    executeProjectTreeRefreshAction: mocks.executeProjectTreeRefreshAction,
    getCurrentProjectPath: () => mocks.projectState.projectPath,
}));

vi.mock('../../store/storeBootstrap', () => ({
    useProjectStore: {
        getState: () => mocks.projectState,
        setState: (updater: ((state: typeof mocks.projectState) => Partial<typeof mocks.projectState>) | Partial<typeof mocks.projectState>) => {
            Object.assign(mocks.projectState, typeof updater === 'function' ? updater(mocks.projectState) : updater);
        },
    },
}));

vi.mock('../../store/useReferenceStore', () => ({
    useReferenceStore: {
        getState: () => ({
            result: mocks.referenceResult,
        }),
    },
}));

vi.mock('../../store/useWorkbenchStore', () => ({
    useWorkbenchStore: {
        getState: () => ({
            renameTabPath: mocks.renameTabPath,
            tabs: mocks.workbenchTabs,
            updateTabContent: mocks.updateTabContent,
        }),
    },
}));

vi.mock('../fs', () => ({
    fsDirname: (path: string) => Promise.resolve(path.replaceAll('\\', '/').replace(/\/[^/]*$/u, '') || '/'),
    fsJoin: (...parts: string[]) => Promise.resolve(parts.join('/').replaceAll('\\', '/').replaceAll(/\/+/gu, '/')),
    fsMkdir: vi.fn(() => Promise.resolve()),
    fsOpenPath: vi.fn(() => Promise.resolve()),
    fsPickDirectory: vi.fn(() => Promise.resolve('/project/assets/sprites')),
    fsReadBinaryFile: vi.fn(() => Promise.resolve(new Uint8Array())),
    fsReadDirectory: mocks.fsReadDirectory,
    fsReadTextFile: mocks.fsReadTextFile,
    fsRemove: mocks.fsRemove,
    fsRename: mocks.fsRename,
    fsWriteBinaryFile: vi.fn(() => Promise.resolve()),
    fsWriteTextFile: mocks.fsWriteTextFile,
}));

vi.mock('../referenceScanner', () => ({
    refreshReferenceScannerState: mocks.refreshReferenceScannerState,
}));

vi.mock('../referenceScanner/assets', () => ({
    normalizeAssetReference: (assetUrl: string) => {
        const normalized = assetUrl.trim().replaceAll('\\', '/');
        if (!normalized) return;
        if (/^[a-z]+:\/\//iu.test(normalized) || normalized.startsWith('data:')) return;
        if (normalized.startsWith('/assets/')) return normalized;
        if (normalized.startsWith('assets/')) return `/${normalized}`;
        return `/assets/${normalized.replace(/^\/+/u, '')}`;
    },
    toProjectAssetUrl: (filePath: string, projectPath: string | undefined) => {
        if (!projectPath) return;
        const normalizedProject = projectPath.replaceAll('\\', '/').replace(/\/+$/u, '');
        const normalizedFile = filePath.replaceAll('\\', '/');
        if (!normalizedFile.startsWith(`${normalizedProject}/assets/`)) return;
        return normalizedFile.slice(normalizedProject.length);
    },
}));

import { deletePath, deletePaths, moveAssetDirectoryPathToDirectory, moveAssetPathToDirectory } from '../explorerFileActions';

describe('explorerFileActions moveAssetPathToDirectory', () => {
    beforeEach(() => {
        mocks.consoleMessage.mockClear();
        mocks.executeProjectTreeRefreshAction.mockClear();
        mocks.fsReadDirectory.mockClear();
        mocks.fsRemove.mockClear();
        mocks.fsReadTextFile.mockClear();
        mocks.fsReadTextFile.mockImplementation(() => Promise.resolve(JSON.stringify({
            commands: [
                { assetUrl: '/assets/bg/office.png', type: 'background' },
            ],
        })));
        mocks.fsRename.mockClear();
        mocks.fsWriteTextFile.mockClear();
        mocks.projectState.activeFile = '/project/assets/bg/office.png';
        mocks.projectState.dirtyFiles = new Set<string>();
        mocks.projectState.expandedPaths = ['/project/assets/bg'];
        mocks.projectState.loadManifest.mockClear();
        mocks.projectState.projectPath = '/project';
        mocks.referenceResult.assetFiles = {
            '/assets/bg/office.png': [
                {
                    commandType: 'background',
                    filePath: '/project/scenes/intro.json',
                    path: [0],
                    sceneName: 'intro',
                },
            ],
        };
        mocks.refreshReferenceScannerState.mockClear();
        mocks.renameTabPath.mockClear();
        mocks.workbenchTabs.length = 0;
    });

    it('moves project assets and rewrites clean references', async () => {
        await expect(moveAssetPathToDirectory(
            '/project/assets/bg/office.png',
            '/project/assets/sprites',
        )).resolves.toBe('/project/assets/sprites/office.png');

        expect(mocks.fsRename).toHaveBeenCalledWith(
            '/project/assets/bg/office.png',
            '/project/assets/sprites/office.png',
        );
        expect(mocks.fsWriteTextFile).toHaveBeenCalledWith(
            '/project/scenes/intro.json',
            expect.stringContaining('"assetUrl": "/assets/sprites/office.png"'),
        );
        expect(mocks.renameTabPath).toHaveBeenCalledWith('/project/assets/sprites/office.png', '/project/assets/bg/office.png');
        expect(mocks.projectState.activeFile).toBe('/project/assets/sprites/office.png');
        expect(mocks.projectState.loadManifest).toHaveBeenCalledTimes(1);
        expect(mocks.refreshReferenceScannerState).toHaveBeenCalledTimes(1);
    });

    it('blocks asset moves when referenced files are dirty', async () => {
        mocks.projectState.dirtyFiles = new Set(['/project/scenes/intro.json']);

        await expect(moveAssetPathToDirectory(
            '/project/assets/bg/office.png',
            '/project/assets/sprites',
        )).resolves.toBeUndefined();

        expect(mocks.fsRename).not.toHaveBeenCalled();
        expect(mocks.fsWriteTextFile).not.toHaveBeenCalled();
        expect(mocks.consoleMessage).toHaveBeenCalledWith(
            'editor',
            'warn',
            'Move aborted: save referenced files before updating asset references:',
            '/project/scenes/intro.json',
        );
    });

    it('moves project asset folders and rewrites every referenced child asset once per file', async () => {
        mocks.fsReadTextFile.mockResolvedValueOnce(JSON.stringify({
            commands: [
                { assetUrl: '/assets/bg/office.png', type: 'background' },
                { assetUrl: '/assets/bg/office-night.png', type: 'background' },
            ],
        }));
        mocks.projectState.activeFile = '/project/assets/bg/office-night.png';
        mocks.projectState.expandedPaths = ['/project/assets/bg', '/project/assets/bg/nested'];
        mocks.referenceResult.assetFiles = {
            '/assets/bg/office-night.png': [
                {
                    commandType: 'background',
                    filePath: '/project/scenes/intro.json',
                    path: [1],
                    sceneName: 'intro',
                },
            ],
            '/assets/bg/office.png': [
                {
                    commandType: 'background',
                    filePath: '/project/scenes/intro.json',
                    path: [0],
                    sceneName: 'intro',
                },
            ],
        };
        mocks.workbenchTabs.push({
            id: 'asset::/project/assets/bg/office-night.png',
            kind: 'asset',
            path: '/project/assets/bg/office-night.png',
            title: 'office-night.png',
        });

        await expect(moveAssetDirectoryPathToDirectory(
            '/project/assets/bg',
            '/project/assets/sprites',
        )).resolves.toBe('/project/assets/sprites/bg');

        expect(mocks.fsRename).toHaveBeenCalledWith(
            '/project/assets/bg',
            '/project/assets/sprites/bg',
        );
        expect(mocks.fsWriteTextFile).toHaveBeenCalledTimes(1);
        expect(mocks.fsWriteTextFile).toHaveBeenCalledWith(
            '/project/scenes/intro.json',
            expect.stringContaining('"assetUrl": "/assets/sprites/bg/office.png"'),
        );
        expect(mocks.fsWriteTextFile).toHaveBeenCalledWith(
            '/project/scenes/intro.json',
            expect.stringContaining('"assetUrl": "/assets/sprites/bg/office-night.png"'),
        );
        expect(mocks.renameTabPath).toHaveBeenCalledWith('/project/assets/sprites/bg', '/project/assets/bg');
        expect(mocks.renameTabPath).toHaveBeenCalledWith(
            '/project/assets/sprites/bg/office-night.png',
            '/project/assets/bg/office-night.png',
        );
        expect(mocks.projectState.activeFile).toBe('/project/assets/sprites/bg/office-night.png');
        expect(mocks.projectState.expandedPaths).toEqual(['/project/assets/sprites/bg', '/project/assets/sprites/bg/nested']);
        expect(mocks.projectState.loadManifest).toHaveBeenCalledTimes(1);
        expect(mocks.refreshReferenceScannerState).toHaveBeenCalledTimes(1);
    });

    it('blocks deleting referenced project asset files', async () => {
        await deletePath('/project/assets/bg/office.png');

        expect(mocks.fsRemove).not.toHaveBeenCalled();
        expect(mocks.consoleMessage).toHaveBeenCalledWith(
            'editor',
            'warn',
            'Delete aborted: remove asset references before deleting:',
            '/assets/bg/office.png',
        );
        expect(mocks.refreshReferenceScannerState).not.toHaveBeenCalled();
    });

    it('blocks deleting asset folders that contain referenced child assets', async () => {
        await deletePath('/project/assets/bg');

        expect(mocks.fsRemove).not.toHaveBeenCalled();
        expect(mocks.consoleMessage).toHaveBeenCalledWith(
            'editor',
            'warn',
            'Delete aborted: remove asset references before deleting:',
            '/assets/bg/office.png',
        );
    });

    it('skips referenced assets during bulk delete and refreshes references for deleted assets', async () => {
        await expect(deletePaths([
            '/project/assets/bg/office.png',
            '/project/assets/bg/unused.png',
        ])).resolves.toBe(1);

        expect(mocks.fsRemove).toHaveBeenCalledTimes(1);
        expect(mocks.fsRemove).toHaveBeenCalledWith('/project/assets/bg/unused.png', true);
        expect(mocks.consoleMessage).toHaveBeenCalledWith(
            'editor',
            'warn',
            'Delete skipped for /project/assets/bg/office.png: remove asset references before deleting:',
            '/assets/bg/office.png',
        );
        expect(mocks.refreshReferenceScannerState).toHaveBeenCalledTimes(1);
    });
});
