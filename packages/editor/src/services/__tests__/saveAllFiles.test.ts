import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ProjectGet } from '../../store/project/types';
import type { WorkbenchTab } from '../../store/workbench/types';

const mocks = vi.hoisted(() => ({
    workbench: {
        setTabSavedContent: vi.fn(),
        tabs: [] as WorkbenchTab[],
        updateTabContent: vi.fn(),
    },
    write: vi.fn<(path: string, content: string, options?: { expectedContent?: string }) => Promise<void>>(),
}));
vi.mock('../../store/useWorkbenchStore', () => ({ useWorkbenchStore: { getState: () => mocks.workbench, subscribe: () => vi.fn() } }));
vi.mock('../fs', () => ({ fsWriteTextFile: mocks.write }));

import { saveAllFiles } from '../saveAllFiles';

function deferred() {
    let resolve!: () => void;
    const promise = new Promise<void>(done => { resolve = done; });
    return { promise, resolve };
}

function fixture(paths = ['/source/first.txt', '/source/second.txt']) {
    const state = {
        activeFile: undefined as string | undefined,
        clearFileDirty: vi.fn((path: string) => { state.dirtyFiles.delete(path); }),
        dirtyFiles: new Set(paths),
        loadManifest: vi.fn<() => Promise<boolean>>().mockResolvedValue(true),
        localePaths: { en: '/source/locales/en.json' } as Record<string, string | undefined>,
        locales: { en: { locale: 'en', namespaces: { intro: { line: 'Original' } } } },
        projectGeneration: 1,
        projectPath: '/source',
        saveActiveFileFromCurrentScript: vi.fn<() => Promise<void>>().mockResolvedValue(),
    };
    mocks.workbench.tabs = paths.map(path => ({
        dirty: true, id: path, kind: 'text', path, savedTextContent: 'original', textContent: `draft:${path}`, title: path,
    }));
    mocks.workbench.setTabSavedContent.mockImplementation((id: string, text: string) => {
        mocks.workbench.tabs = mocks.workbench.tabs.map(tab => tab.id === id ? { ...tab, savedTextContent: text } : tab);
    });
    mocks.workbench.updateTabContent.mockImplementation((id: string, text: string) => {
        mocks.workbench.tabs = mocks.workbench.tabs.map(tab => tab.id === id ? { ...tab, dirty: false, savedTextContent: text, textContent: text } : tab);
        state.clearFileDirty(id);
    });
    const getState = (() => state) as unknown as ProjectGet;
    return { getState, state };
}

describe('save all dirty files ownership', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.write.mockReset().mockResolvedValue();
    });

    it('saves current drafts with their loaded disk snapshots', async () => {
        const { getState, state } = fixture();
        const paths = [...state.dirtyFiles];
        expect(await saveAllFiles(getState)).toEqual({ failed: [], saved: paths, skipped: [] });
        expect(mocks.write).toHaveBeenCalledWith('/source/first.txt', 'draft:/source/first.txt', { expectedContent: 'original' }, expect.any(Function));
        expect(state.dirtyFiles.size).toBe(0);
    });

    it.each(['/source/game.json', '/source/locales/en.json', '/source/./game.json', '/source/locales//en.json'])('refreshes saved localization models after saving %s', async path => {
        const { getState, state } = fixture([path]);
        mocks.workbench.tabs[0].textContent = JSON.stringify(state.locales.en);
        await expect(saveAllFiles(getState)).resolves.toMatchObject({ saved: [path] });
        expect(state.loadManifest).toHaveBeenCalledOnce();
        expect(state.dirtyFiles.size).toBe(0);
    });

    it.each(['locale', 'inline'] as const)('keeps invalid raw %s drafts unsaved and never writes them', async kind => {
        const path = kind === 'inline' ? '/source/game.json' : '/source/locales/en.json';
        const { getState, state } = fixture([path]);
        if (kind === 'inline') state.localePaths.en = undefined;
        mocks.workbench.tabs[0].textContent = '{';
        const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
        try {
            await expect(saveAllFiles(getState)).resolves.toEqual({ failed: [path], saved: [], skipped: [] });
            expect(mocks.write).not.toHaveBeenCalled();
            expect(state.dirtyFiles.has(path)).toBe(true);
            expect(mocks.workbench.tabs[0]).toMatchObject({ savedTextContent: 'original', textContent: '{' });
        } finally { errors.mockRestore(); }
    });

    it('reads each later tab again instead of saving an old all-tabs snapshot', async () => {
        const { getState, state } = fixture();
        const pendingWrite = deferred();
        mocks.write.mockReturnValueOnce(pendingWrite.promise);
        const pending = saveAllFiles(getState);
        mocks.workbench.tabs = mocks.workbench.tabs.map(tab => tab.path.endsWith('second.txt') ? { ...tab, textContent: 'newer second draft' } : tab);
        pendingWrite.resolve();
        await expect(pending).resolves.toMatchObject({ failed: [], saved: ['/source/first.txt', '/source/second.txt'], skipped: [] });
        expect(mocks.write).toHaveBeenCalledWith('/source/second.txt', 'newer second draft', { expectedContent: 'original' }, expect.any(Function));
        expect(mocks.workbench.tabs[1].textContent).toBe('newer second draft');
        expect(state.dirtyFiles.size).toBe(0);
    });

    it.each(['immutable edit', 'in-place edit', 'replacement', 'closed tab'])('never cleans a %s while its write is pending', async change => {
        const { getState, state } = fixture(['/source/first.txt']);
        const pendingWrite = deferred();
        mocks.write.mockReturnValueOnce(pendingWrite.promise);
        const pending = saveAllFiles(getState);
        const original = mocks.workbench.tabs[0];
        switch (change) {
        case 'immutable edit': {
        mocks.workbench.tabs = [{ ...original, textContent: 'newer draft' }];
        break;
        }
        case 'in-place edit': {
        original.textContent = 'newer draft';
        break;
        }
        case 'replacement': {
        mocks.workbench.tabs = [{ ...original }];
        break;
        }
        default: { mocks.workbench.tabs = [];
        }
        }
        pendingWrite.resolve();
        await expect(pending).resolves.toEqual({ failed: [], saved: [], skipped: ['/source/first.txt'] });
        expect(state.dirtyFiles.has('/source/first.txt')).toBe(true);
        expect(mocks.workbench.updateTabContent).not.toHaveBeenCalled();
        if (change === 'closed tab') expect(mocks.workbench.setTabSavedContent).not.toHaveBeenCalled();
        else expect(mocks.workbench.tabs[0].savedTextContent).toBe('draft:/source/first.txt');
        if (change.endsWith('edit')) expect(mocks.workbench.tabs[0].textContent).toBe('newer draft');
    });

    it.each(['generation', 'path'])('stops before later writes when the project %s changes', async change => {
        const { getState, state } = fixture();
        const pendingWrite = deferred();
        mocks.write.mockReturnValueOnce(pendingWrite.promise);
        const pending = saveAllFiles(getState);
        if (change === 'generation') state.projectGeneration += 1;
        else state.projectPath = '/replacement';
        pendingWrite.resolve();
        await expect(pending).resolves.toEqual({ failed: [], saved: [], skipped: ['/source/first.txt', '/source/second.txt'] });
        expect(mocks.write).toHaveBeenCalledTimes(1);
        expect(mocks.workbench.updateTabContent).not.toHaveBeenCalled();
        expect(state.clearFileDirty).not.toHaveBeenCalled();
        expect(state.dirtyFiles.size).toBe(2);
    });

    it('keeps a newer draft dirty and allows retry against the revision actually written', async () => {
        const { getState, state } = fixture(['/source/first.txt']);
        const pendingWrite = deferred();
        mocks.write.mockReturnValueOnce(pendingWrite.promise);
        const pending = saveAllFiles(getState);
        mocks.workbench.tabs = [{ ...mocks.workbench.tabs[0], textContent: 'newer draft' }];
        pendingWrite.resolve();
        await expect(pending).resolves.toMatchObject({ skipped: ['/source/first.txt'] });
        expect(state.dirtyFiles.size).toBe(1);
        await expect(saveAllFiles(getState)).resolves.toMatchObject({ saved: ['/source/first.txt'], skipped: [] });
        expect(mocks.write).toHaveBeenLastCalledWith('/source/first.txt', 'newer draft', { expectedContent: 'draft:/source/first.txt' }, expect.any(Function));
        expect(mocks.workbench.tabs[0].textContent).toBe('newer draft');
    });

    it('does not replace a saved baseline changed by another operation', async () => {
        const { getState } = fixture(['/source/first.txt']);
        const pendingWrite = deferred();
        mocks.write.mockReturnValueOnce(pendingWrite.promise);
        const pending = saveAllFiles(getState);
        mocks.workbench.tabs = [{ ...mocks.workbench.tabs[0], savedTextContent: 'different saved revision' }];
        pendingWrite.resolve();
        await expect(pending).resolves.toMatchObject({ skipped: ['/source/first.txt'] });
        expect(mocks.workbench.setTabSavedContent).not.toHaveBeenCalled();
        expect(mocks.workbench.tabs[0].savedTextContent).toBe('different saved revision');
    });

    it('does not reconcile a failed write into a replacement project', async () => {
        const { getState, state } = fixture();
        mocks.write.mockImplementationOnce(() => {
            state.projectGeneration += 1;
            return Promise.reject(new Error('Earlier write failed'));
        });
        await expect(saveAllFiles(getState)).resolves.toEqual({ failed: [], saved: [], skipped: ['/source/first.txt', '/source/second.txt'] });
        expect(mocks.write).toHaveBeenCalledTimes(1);
        expect(mocks.workbench.setTabSavedContent).not.toHaveBeenCalled();
        expect(state.clearFileDirty).not.toHaveBeenCalled();
    });

    it('does not report an active save successful or continue after same-path replacement', async () => {
        const { getState, state } = fixture();
        state.activeFile = '/source/first.txt';
        const pendingWrite = deferred();
        state.saveActiveFileFromCurrentScript.mockReturnValueOnce(pendingWrite.promise);
        const pending = saveAllFiles(getState);
        state.projectGeneration += 1;
        pendingWrite.resolve();
        await expect(pending).resolves.toEqual({ failed: [], saved: [], skipped: ['/source/first.txt', '/source/second.txt'] });
        expect(mocks.write).not.toHaveBeenCalled();
    });

    it('keeps an active file failed when newer edits remain dirty after its save', async () => {
        const { getState, state } = fixture(['/source/first.txt']);
        state.activeFile = '/source/first.txt';
        await expect(saveAllFiles(getState)).resolves.toEqual({ failed: ['/source/first.txt'], saved: [], skipped: [] });
        expect(state.dirtyFiles.size).toBe(1);
    });

    it('reports write failures without changing drafts or dirty state', async () => {
        const { getState, state } = fixture(['/source/first.txt']);
        vi.spyOn(console, 'error').mockImplementation(() => {});
        mocks.write.mockRejectedValueOnce(new Error('Write denied'));
        await expect(saveAllFiles(getState)).resolves.toEqual({ failed: ['/source/first.txt'], saved: [], skipped: [] });
        expect(state.dirtyFiles.size).toBe(1);
        expect(mocks.workbench.tabs[0].textContent).toBe('draft:/source/first.txt');
        expect(mocks.workbench.updateTabContent).not.toHaveBeenCalled();
        vi.restoreAllMocks();
    });
});
