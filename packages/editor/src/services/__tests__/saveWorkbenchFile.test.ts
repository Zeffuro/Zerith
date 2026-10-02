import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    setTabSavedContent: vi.fn(),
    tabs: [{ dirty: true, id: 'scene', path: '/scene.json', savedTextContent: 'original', textContent: 'edited' }],
    writeTextFile: vi.fn<() => Promise<void>>(),
}));

vi.mock('../../store/useWorkbenchStore', () => ({ useWorkbenchStore: { getState: () => mocks } }));
vi.mock('../fs', () => ({ fsWriteTextFile: mocks.writeTextFile }));

import { saveWorkbenchTextFile } from '../saveWorkbenchFile';

describe('workbench guarded saves', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.writeTextFile.mockResolvedValue();
        mocks.tabs[0].textContent = 'edited';
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
});
