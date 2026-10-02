import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ReferenceScannerResult } from '../referenceScanner';

const mocks = vi.hoisted(() => {
    const projectState = {
        activeFile: '/project/assets/bg/office.png',
        dirtyFiles: new Set<string>(),
        expandedPaths: ['/project/assets/bg'],
        loadManifest: vi.fn(() => Promise.resolve()),
        projectGeneration: 1,
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
        applyMacrosFile: vi.fn(),
        applyScriptFile: vi.fn(),
        consoleMessage: vi.fn(),
        executeProjectTreeRefreshAction: vi.fn(),
        fsReadDirectory: vi.fn(() => Promise.resolve([])),
        fsReadTextFile: vi.fn<(path: string) => Promise<string>>(() => Promise.resolve(JSON.stringify({
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
        setTabSavedContent: vi.fn(),
        updateTabContent: vi.fn(),
        workbenchTabs: [] as Array<{
            dirty?: boolean;
            id: string;
            kind: string;
            path: string;
            savedTextContent?: string;
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
            setTabSavedContent: mocks.setTabSavedContent,
            tabs: mocks.workbenchTabs,
            updateTabContent: mocks.updateTabContent,
        }),
    },
}));

vi.mock('../projectOpeners', () => ({
    applyMacrosFile: mocks.applyMacrosFile,
    applyScriptFile: mocks.applyScriptFile,
}));

vi.mock('../assetLibraryMetadata', () => ({
    loadAssetLibraryMetadata: () => Promise.resolve({ assets: {} }),
    moveAssetLibraryMetadataScope: (metadata: unknown) => metadata,
    saveAssetLibraryMetadata: () => Promise.resolve(),
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

import { deletePath, deletePaths, moveAssetDirectoryPathToDirectory, moveAssetPathToDirectory, renamePath } from '../explorerFileActions';

describe('explorerFileActions moveAssetPathToDirectory', () => {
    beforeEach(() => {
        mocks.consoleMessage.mockClear();
        mocks.applyScriptFile.mockClear();
        mocks.applyMacrosFile.mockClear();
        mocks.executeProjectTreeRefreshAction.mockClear();
        mocks.fsReadDirectory.mockReset();
        mocks.fsReadDirectory.mockResolvedValue([]);
        mocks.fsRemove.mockClear();
        mocks.fsReadTextFile.mockReset();
        mocks.fsReadTextFile.mockImplementation(() => Promise.resolve(JSON.stringify({
            commands: [
                { assetUrl: '/assets/bg/office.png', type: 'background' },
            ],
        })));
        mocks.fsRename.mockReset();
        mocks.fsRename.mockResolvedValue();
        mocks.renameTabPath.mockImplementation((nextPath: string, oldPath: string) => {
            for (const tab of mocks.workbenchTabs) {
                if (tab.path === oldPath) { tab.path = nextPath; tab.id = `${tab.kind}::${nextPath}`; }
            }
        });
        mocks.fsWriteTextFile.mockReset();
        mocks.fsWriteTextFile.mockResolvedValue();
        mocks.updateTabContent.mockClear();
        mocks.setTabSavedContent.mockClear();
        mocks.projectState.activeFile = '/project/assets/bg/office.png';
        mocks.projectState.dirtyFiles = new Set<string>();
        mocks.projectState.expandedPaths = ['/project/assets/bg'];
        mocks.projectState.loadManifest.mockReset();
        mocks.projectState.loadManifest.mockResolvedValue();
        mocks.projectState.projectPath = '/project';
        mocks.projectState.projectGeneration = 1;
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
            { expectedContent: JSON.stringify({ commands: [{ assetUrl: '/assets/bg/office.png', type: 'background' }] }) },
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
        mocks.fsReadTextFile.mockResolvedValue(JSON.stringify({
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
            { expectedContent: JSON.stringify({ commands: [{ assetUrl: '/assets/bg/office.png', type: 'background' }, { assetUrl: '/assets/bg/office-night.png', type: 'background' }] }) },
        );
        expect(mocks.fsWriteTextFile).toHaveBeenCalledWith(
            '/project/scenes/intro.json',
            expect.stringContaining('"assetUrl": "/assets/sprites/bg/office-night.png"'),
            { expectedContent: JSON.stringify({ commands: [{ assetUrl: '/assets/bg/office.png', type: 'background' }, { assetUrl: '/assets/bg/office-night.png', type: 'background' }] }) },
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

    it('reconciles committed tabs and refreshes after a later reference write fails', async () => {
        const references = mocks.referenceResult.assetFiles['/assets/bg/office.png'];
        references.push({ ...references[0], filePath: '/project/scenes/second.json' });
        for (const path of ['/project/scenes/intro.json', '/project/scenes/second.json']) {
            mocks.workbenchTabs.push({ id: path, kind: 'script', path, textContent: 'original', title: path });
        }
        mocks.fsWriteTextFile.mockResolvedValueOnce().mockRejectedValueOnce(new Error('disk full'));

        await expect(moveAssetPathToDirectory('/project/assets/bg/office.png', '/project/assets/sprites')).resolves.toBeUndefined();

        expect(mocks.updateTabContent).toHaveBeenCalledTimes(1);
        expect(mocks.updateTabContent).toHaveBeenCalledWith('/project/scenes/intro.json', expect.stringContaining('/assets/sprites/office.png'), { markDirty: false });
        expect(mocks.executeProjectTreeRefreshAction).toHaveBeenCalledTimes(1);
        expect(mocks.projectState.loadManifest).toHaveBeenCalledTimes(1);
        expect(mocks.refreshReferenceScannerState).toHaveBeenCalledTimes(1);
        expect(mocks.consoleMessage).toHaveBeenCalledWith('editor', 'error', 'Path moved to /project/assets/sprites/office.png, but reference updates are incomplete:', expect.stringContaining('1 file(s) saved, 1 remaining'));
    });

    it('preserves edits made while the committed rewrite is pending and advances only its baseline', async () => {
        mocks.workbenchTabs.push({ id: 'intro', kind: 'script', path: '/project/scenes/intro.json', textContent: 'original', title: 'intro' });
        mocks.fsWriteTextFile.mockImplementationOnce(() => {
            mocks.workbenchTabs[0].textContent = 'new unsaved edit';
            mocks.workbenchTabs[0].dirty = true;
            mocks.projectState.dirtyFiles.add('/project/scenes/intro.json');
            return Promise.resolve();
        });

        await moveAssetPathToDirectory('/project/assets/bg/office.png', '/project/assets/sprites');

        expect(mocks.updateTabContent).not.toHaveBeenCalled();
        expect(mocks.setTabSavedContent).toHaveBeenCalledWith('intro', expect.stringContaining('/assets/sprites/office.png'));
        expect(mocks.workbenchTabs[0].textContent).toBe('new unsaved edit');
        expect(mocks.projectState.dirtyFiles.has('/project/scenes/intro.json')).toBe(true);
    });

    it('rewrites a moved descriptor at its new path relative to its new directory', async () => {
        const original = JSON.stringify({ source: '../shared/hero.png' });
        const oldDescriptor = '/project/assets/bg/hero.sheet.json';
        const newDescriptor = '/project/assets/sprites/bg/hero.sheet.json';
        let moved = false;
        mocks.fsReadTextFile.mockImplementation((path: string) => {
            if (path !== (moved ? newDescriptor : oldDescriptor)) return Promise.reject(new Error('missing file'));
            return Promise.resolve(original);
        });
        mocks.fsRename.mockImplementationOnce(() => { moved = true; return Promise.resolve(); });
        mocks.workbenchTabs.push({ id: 'sheet', kind: 'spritesheet', path: oldDescriptor, textContent: original, title: 'sheet' });
        mocks.referenceResult.assetFiles = {
            '/assets/shared/hero.png': [{ commandType: 'character.spritesheet.source', filePath: oldDescriptor, path: ['source'], sceneName: 'data:characters' }],
        };

        await moveAssetDirectoryPathToDirectory('/project/assets/bg', '/project/assets/sprites');

        expect(mocks.fsWriteTextFile).toHaveBeenCalledWith(newDescriptor, expect.stringContaining('"source": "../../shared/hero.png"'), { expectedContent: original });
        expect(mocks.fsReadTextFile.mock.calls.map(([path]) => path)).toEqual([oldDescriptor, newDescriptor]);
        expect(mocks.updateTabContent).toHaveBeenCalledWith(`spritesheet::${newDescriptor}`, expect.stringContaining('../../shared/hero.png'), { markDirty: false });
    });

    it('refreshes after rename preflight failure without marking unwritten tabs clean', async () => {
        mocks.fsReadTextFile.mockResolvedValueOnce(JSON.stringify({ commands: [{ assetUrl: '/assets/bg/office.png', type: 'background' }] })).mockResolvedValueOnce('external change');
        await renamePath('/project/assets/bg/office.png', 'renamed.png');
        expect(mocks.fsRename).toHaveBeenCalledTimes(1);
        expect(mocks.fsWriteTextFile).not.toHaveBeenCalled();
        expect(mocks.updateTabContent).not.toHaveBeenCalled();
        expect(mocks.setTabSavedContent).not.toHaveBeenCalled();
        expect(mocks.executeProjectTreeRefreshAction).toHaveBeenCalledTimes(1);
        expect(mocks.projectState.loadManifest).toHaveBeenCalledTimes(1);
        expect(mocks.refreshReferenceScannerState).toHaveBeenCalledTimes(1);
    });

    it('continues manifest and scanner refresh when tree refresh fails after the move', async () => {
        mocks.fsReadDirectory.mockResolvedValueOnce([]).mockRejectedValueOnce(new Error('directory unreadable'));
        await expect(moveAssetPathToDirectory('/project/assets/bg/office.png', '/project/assets/sprites')).resolves.toBeUndefined();
        expect(mocks.fsRename).toHaveBeenCalledTimes(1);
        expect(mocks.projectState.loadManifest).toHaveBeenCalledTimes(1);
        expect(mocks.refreshReferenceScannerState).toHaveBeenCalledTimes(1);
        expect(mocks.consoleMessage).toHaveBeenCalledWith('editor', 'error', 'Path moved to /project/assets/sprites/office.png, but project refresh failed:', expect.stringContaining('directory unreadable'));
    });

    it('refreshes partial browser copies without remapping dirty source tabs', async () => {
        mocks.referenceResult.assetFiles = {};
        const sourcePath = '/project/assets/bg/notes.txt';
        mocks.workbenchTabs.push({ dirty: true, id: 'notes', kind: 'text', path: sourcePath, textContent: 'unsaved edit', title: 'notes' });
        mocks.projectState.dirtyFiles.add(sourcePath);
        mocks.projectState.activeFile = sourcePath;
        mocks.fsRename.mockRejectedValueOnce(new Error('Source remains; partial destination remains at /project/assets/sprites/bg.'));

        await moveAssetDirectoryPathToDirectory('/project/assets/bg', '/project/assets/sprites');

        expect(mocks.executeProjectTreeRefreshAction).toHaveBeenCalledTimes(1);
        expect(mocks.renameTabPath).not.toHaveBeenCalled();
        expect(mocks.workbenchTabs[0]).toMatchObject({ dirty: true, path: sourcePath, textContent: 'unsaved edit' });
        expect(mocks.projectState.dirtyFiles.has(sourcePath)).toBe(true);
        expect(mocks.projectState.activeFile).toBe(sourcePath);
        expect(mocks.updateTabContent).not.toHaveBeenCalled();
    });

    it('does not refresh another project after an old project copy fails', async () => {
        mocks.referenceResult.assetFiles = {};
        mocks.fsRename.mockImplementationOnce(() => {
            mocks.projectState.projectPath = '/other-project';
            mocks.projectState.projectGeneration += 1;
            return Promise.reject(new Error('Copy failed'));
        });

        await moveAssetDirectoryPathToDirectory('/project/assets/bg', '/project/assets/sprites');

        expect(mocks.executeProjectTreeRefreshAction).not.toHaveBeenCalled();
        expect(mocks.renameTabPath).not.toHaveBeenCalled();
    });

    it('does not refresh a newly selected project after completing the old project disk move', async () => {
        mocks.fsWriteTextFile.mockImplementationOnce(() => {
            mocks.projectState.projectPath = '/other-project';
            mocks.projectState.projectGeneration += 1;
            return Promise.resolve();
        });
        await moveAssetPathToDirectory('/project/assets/bg/office.png', '/project/assets/sprites');
        expect(mocks.updateTabContent).not.toHaveBeenCalled();
        expect(mocks.executeProjectTreeRefreshAction).not.toHaveBeenCalled();
        expect(mocks.projectState.loadManifest).not.toHaveBeenCalled();
        expect(mocks.refreshReferenceScannerState).not.toHaveBeenCalled();
    });

    it('updates the clean active visual script even when its tab has no text content', async () => {
        mocks.projectState.activeFile = '/project/scenes/intro.json';
        mocks.workbenchTabs.push({ id: 'intro', kind: 'script', path: '/project/scenes/intro.json', title: 'intro' });
        await moveAssetPathToDirectory('/project/assets/bg/office.png', '/project/assets/sprites');
        expect(mocks.applyScriptFile).toHaveBeenCalledWith('/project/scenes/intro.json', { commands: [{ assetUrl: '/assets/sprites/office.png', type: 'background' }] });
        expect(mocks.updateTabContent).toHaveBeenCalledWith('intro', expect.stringContaining('/assets/sprites/office.png'), { markDirty: false });
    });

    it('renames folders with descendant tabs and dirty paths while preserving their contents', async () => {
        mocks.referenceResult.assetFiles = {};
        const oldPath = '/project/assets/bg/notes.txt';
        const newPath = '/project/assets/renamed/notes.txt';
        mocks.projectState.activeFile = oldPath;
        mocks.projectState.dirtyFiles.add(oldPath);
        mocks.workbenchTabs.push({ dirty: true, id: 'notes', kind: 'text', path: oldPath, textContent: 'unsaved notes', title: 'notes' });

        await renamePath('/project/assets/bg', 'renamed');

        expect(mocks.workbenchTabs[0].path).toBe(newPath);
        expect(mocks.workbenchTabs[0].textContent).toBe('unsaved notes');
        expect(mocks.projectState.activeFile).toBe(newPath);
        expect([...mocks.projectState.dirtyFiles]).toEqual([newPath]);
        expect(mocks.updateTabContent).not.toHaveBeenCalled();
    });

    it('aborts before moving when a referenced file becomes dirty during planning', async () => {
        mocks.fsReadTextFile.mockImplementationOnce(() => {
            mocks.projectState.dirtyFiles.add('/project/scenes/intro.json');
            return Promise.resolve(JSON.stringify({ commands: [{ assetUrl: '/assets/bg/office.png', type: 'background' }] }));
        });
        await expect(moveAssetPathToDirectory('/project/assets/bg/office.png', '/project/assets/sprites')).resolves.toBeUndefined();
        expect(mocks.fsRename).not.toHaveBeenCalled();
        expect(mocks.fsWriteTextFile).not.toHaveBeenCalled();
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
