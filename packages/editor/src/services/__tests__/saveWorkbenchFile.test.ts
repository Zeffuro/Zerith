import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ProjectState } from '../../store/project/types';

const mocks = vi.hoisted(() => ({
    readTextFile: vi.fn<() => Promise<string>>(),
    setTabSavedContent: vi.fn(),
    tabs: [{ dirty: true, id: 'scene', path: '/scene.json', savedTextContent: 'original', textContent: 'edited' }],
    updateTabContent: vi.fn(),
    writeTextFile: vi.fn<() => Promise<void>>(),
}));

vi.mock('../../store/useWorkbenchStore', () => ({ useWorkbenchStore: { getState: () => mocks, subscribe: () => vi.fn() } }));
vi.mock('../fs', () => ({ fsReadTextFile: mocks.readTextFile, fsWriteTextFile: mocks.writeTextFile }));

import { createProjectIoSlice } from '../../store/project/slices/ioSlice';
import { saveWorkbenchTextFile } from '../saveWorkbenchFile';

function activeSession(mode: 'all-macros' | 'macro' | 'scene') {
    mocks.tabs[0] = { ...mocks.tabs[0], savedTextContent: '[]', textContent: '[]' };
    const clearFileDirty = vi.fn();
    const state = {
        activeFile: '/scene.json',
        activeMacroName: mode === 'macro' ? 'greet' : undefined,
        clearFileDirty,
        editingAllMacrosFile: mode === 'all-macros',
        macroEntries: [],
        projectGeneration: 1,
        projectPath: '/source',
    } as unknown as ProjectState;
    const commands = [{ text: 'draft', type: 'dialogue' as const }];
    const slice = createProjectIoSlice(() => state, { getRootScript: () => commands, setScript: vi.fn() });
    return { clearFileDirty, slice, state };
}

function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>(done => { resolve = done; });
    return { promise, resolve };
}

describe('workbench guarded saves', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.writeTextFile.mockReset().mockResolvedValue();
        mocks.readTextFile.mockReset().mockResolvedValue('{}');
        mocks.setTabSavedContent.mockReset().mockImplementation((id: string, content: string) => {
            mocks.tabs = mocks.tabs.map(tab => tab.id === id ? { ...tab, savedTextContent: content } : tab);
        });
        mocks.tabs = [{ dirty: true, id: 'scene', path: '/scene.json', savedTextContent: 'original', textContent: 'edited' }];
    });

    it('sends the loaded disk snapshot and advances it only after success', async () => {
        await saveWorkbenchTextFile('/scene.json', 'edited');
        expect(mocks.writeTextFile).toHaveBeenCalledWith('/scene.json', 'edited', { expectedContent: 'original' });
        expect(mocks.setTabSavedContent).toHaveBeenCalledWith('scene', 'edited');
    });

    it('keeps the dirty edit and original snapshot after a stale or failed write', async () => {
        mocks.writeTextFile.mockRejectedValueOnce({ code: 'stale', message: 'external change' });
        await expect(saveWorkbenchTextFile('/scene.json', 'edited')).rejects.toMatchObject({ code: 'stale' });
        expect(mocks.setTabSavedContent).not.toHaveBeenCalled();
        expect(mocks.tabs[0]).toMatchObject({ dirty: true, savedTextContent: 'original', textContent: 'edited' });
    });

    it('keeps a newer edit dirty while recording the revision written to disk', async () => {
        mocks.writeTextFile.mockImplementationOnce(() => {
            mocks.tabs[0].textContent = 'newer edit';
            return Promise.resolve();
        });
        await expect(saveWorkbenchTextFile('/scene.json', 'edited')).rejects.toThrow('Newer edits remain unsaved');
        expect(mocks.setTabSavedContent).toHaveBeenCalledWith('scene', 'edited');
        expect(mocks.tabs[0]).toMatchObject({ dirty: true, textContent: 'newer edit' });
    });

    it('refuses a stale owner before starting a write', async () => {
        await expect(saveWorkbenchTextFile('/scene.json', 'edited', () => false)).rejects.toThrow('Project changed');
        expect(mocks.writeTextFile).not.toHaveBeenCalled();
        expect(mocks.setTabSavedContent).not.toHaveBeenCalled();
    });

    it.each(['all-macros', 'macro', 'scene'] as const)('does not reconcile an earlier %s write into a same-path replacement project', async mode => {
        const { clearFileDirty, slice, state } = activeSession(mode);
        const write = deferred<void>();
        mocks.writeTextFile.mockReturnValueOnce(write.promise);
        const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
        try {
            const saving = slice.saveActiveFileFromCurrentScript();
            await vi.waitFor(() => { expect(mocks.writeTextFile).toHaveBeenCalledTimes(1); });
            state.projectGeneration += 1;
            const replacement = { ...mocks.tabs[0], textContent: 'replacement draft' };
            mocks.tabs = [replacement];
            write.resolve();
            await saving;
            expect(mocks.tabs[0]).toBe(replacement);
            expect(mocks.tabs[0].savedTextContent).toBe('[]');
            expect(mocks.setTabSavedContent).not.toHaveBeenCalled();
            expect(mocks.updateTabContent).not.toHaveBeenCalled();
            expect(clearFileDirty).not.toHaveBeenCalled();
            expect(errors).toHaveBeenCalled();
            expect(String(errors.mock.calls[0]?.[1])).toContain('Project changed');
        } finally { errors.mockRestore(); }
    });

    it.each(['macro', 'scene'] as const)('does not start a stale %s write after its pending disk read completes', async mode => {
        const { clearFileDirty, slice, state } = activeSession(mode);
        if (mode === 'scene') mocks.tabs = [];
        const read = deferred<string>();
        mocks.readTextFile.mockReturnValueOnce(read.promise);
        const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
        try {
            const saving = slice.saveActiveFileFromCurrentScript();
            expect(mocks.readTextFile).toHaveBeenCalledTimes(1);
            state.projectPath = '/replacement';
            read.resolve('{}');
            await saving;
            expect(mocks.writeTextFile).not.toHaveBeenCalled();
            expect(mocks.setTabSavedContent).not.toHaveBeenCalled();
            expect(clearFileDirty).not.toHaveBeenCalled();
        } finally { errors.mockRestore(); }
    });
});
