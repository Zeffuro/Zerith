import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { FsDirectoryEntry } from '../../../services/fs';

const mocks = vi.hoisted(() => {
    const state: {
        projectGeneration: number;
        projectPath: string | undefined;
        setProject: ReturnType<typeof vi.fn>;
        setProjectFiles: ReturnType<typeof vi.fn>;
    } = {
        projectGeneration: 1,
        projectPath: '/A',
        setProject: vi.fn(),
        setProjectFiles: vi.fn(),
    };
    return { readDirectory: vi.fn<(path: string) => Promise<FsDirectoryEntry[]>>(), state };
});

vi.mock('../../../services/fs', () => ({ fsReadDirectory: mocks.readDirectory }));
vi.mock('../../storeBootstrap', () => ({ useProjectStore: { getState: () => mocks.state } }));

import { executeExternalProjectTreeRefreshAction } from '../projectTreeActions';

describe('external project tree refresh', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.state.projectGeneration = 1;
        mocks.state.projectPath = '/A';
    });

    it.each(['/B', undefined])('does not restore A after switching to %s during its directory read', async (newPath) => {
        let complete!: (entries: FsDirectoryEntry[]) => void;
        mocks.readDirectory.mockReturnValueOnce(new Promise((resolve) => { complete = resolve; }));
        const refresh = executeExternalProjectTreeRefreshAction('/A');
        mocks.state.projectPath = newPath;
        mocks.state.projectGeneration += 1;
        complete([]);
        await refresh;
        expect(mocks.state.setProject).not.toHaveBeenCalled();
        expect(mocks.state.setProjectFiles).not.toHaveBeenCalled();
    });

    it('rejects an old session even after A has been reopened', async () => {
        let complete!: (entries: FsDirectoryEntry[]) => void;
        mocks.readDirectory.mockReturnValueOnce(new Promise((resolve) => { complete = resolve; }));
        const refresh = executeExternalProjectTreeRefreshAction('/A');
        mocks.state.projectGeneration += 2;
        complete([]);
        await refresh;
        expect(mocks.state.setProjectFiles).not.toHaveBeenCalled();
    });

    it('updates only the current session, with directories sorted first', async () => {
        const file = { isDirectory: false, isFile: true, isSymlink: false, name: 'a.txt' };
        const folder = { isDirectory: true, isFile: false, isSymlink: false, name: 'z' };
        mocks.readDirectory.mockResolvedValueOnce([file, folder]);
        await executeExternalProjectTreeRefreshAction('/A');
        expect(mocks.state.setProjectFiles).toHaveBeenCalledWith([folder, file]);
        expect(mocks.state.setProject).not.toHaveBeenCalled();
    });
});
