import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ProjectState } from '../../store/project/types';
import type { WorkbenchTab } from '../../store/workbench/types';

const mocks = vi.hoisted(() => ({
    tabs: [] as WorkbenchTab[],
    updateTabContent: vi.fn(),
    writeTextFile: vi.fn<() => Promise<void>>(),
}));
vi.mock('../../store/useWorkbenchStore', () => ({ useWorkbenchStore: { getState: () => mocks } }));
vi.mock('../saveWorkbenchFile', () => ({ saveWorkbenchTextFile: mocks.writeTextFile }));

import { createProjectIoSlice } from '../../store/project/slices/ioSlice';

describe('visual save metadata ownership', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.writeTextFile.mockResolvedValue();
    });

    it.each([false, true])('uses the current %s dirty-state metadata source for later save', async (dirty) => {
        const stale = JSON.stringify({ commands: [], custom: { editor: 'old' }, graph: { entry: 'old' } });
        const saved = JSON.stringify({ commands: [], custom: { editor: 'external' }, graph: { entry: 'external' } });
        const draft = JSON.stringify({ commands: [], custom: { editor: 'draft' }, graph: { entry: 'draft' } });
        mocks.tabs = [{ dirty, id: 'intro', kind: 'script', path: '/intro.json', savedTextContent: saved, textContent: dirty ? draft : stale, title: 'intro' }];
        const commands = [{ text: 'later edit', type: 'dialogue' as const }];
        const clearFileDirty = vi.fn();
        const state = { activeFile: '/intro.json', clearFileDirty, editingAllMacrosFile: false, macroEntries: [], projectGeneration: 1 } as unknown as ProjectState;
        const slice = createProjectIoSlice(() => state, { getRootScript: () => commands, setScript: vi.fn() });
        await slice.saveActiveFileFromCurrentScript();
        const expected = { commands, custom: { editor: dirty ? 'draft' : 'external' }, graph: { entry: dirty ? 'draft' : 'external' } };
        expect(mocks.writeTextFile).toHaveBeenCalledWith('/intro.json', JSON.stringify(expected, undefined, 4), expect.any(Function));
        expect(mocks.updateTabContent).toHaveBeenCalledWith('intro', JSON.stringify(expected, undefined, 4), { markDirty: false });
        expect(clearFileDirty).toHaveBeenCalledWith('/intro.json');
    });
});
