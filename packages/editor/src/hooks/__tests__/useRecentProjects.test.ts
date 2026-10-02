import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ProjectOpenRequest } from '../../store/actions/projectOpenActions';

const mocks = vi.hoisted(() => ({
    announceOperationStatus: vi.fn(),
    beginRequest: vi.fn<() => ProjectOpenRequest>(),
    generation: 1,
    isTauriRuntime: vi.fn(() => false),
    openProject: vi.fn<(path: string) => Promise<{ status: 'cancelled' | 'opened-current' | 'opened-new-window' }>>(),
    restore: vi.fn<(path: string) => Promise<boolean>>(),
    sequence: 0,
}));

vi.mock('../../services/fs/browserFsAdapter', () => ({
    browserFsAdapter: { recentProjects: { restore: mocks.restore } },
}));

vi.mock('../../services/runtime/runtimeEnvironment', () => ({
    isTauriRuntime: mocks.isTauriRuntime,
}));

vi.mock('../../store/actions/projectOpenActions', () => ({
    beginProjectOpenRequest: mocks.beginRequest,
    executeOpenProjectInCurrentWindow: mocks.openProject,
}));

vi.mock('../../store/useEditorStore', () => ({
    useEditorStore: { getState: () => ({ announceOperationStatus: mocks.announceOperationStatus }) },
}));

vi.mock('../../store/useSettingsStore', () => ({ useSettingsStore: vi.fn() }));

import { openRecentProject } from '../useRecentProjects';

describe('openRecentProject', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        mocks.isTauriRuntime.mockReturnValue(false);
        mocks.generation = 1;
        mocks.sequence = 0;
        mocks.beginRequest.mockImplementation(() => {
            const sequence = ++mocks.sequence;
            const generation = mocks.generation;
            return {
                isCurrent: () => sequence === mocks.sequence && generation === mocks.generation,
                isLatest: () => sequence === mocks.sequence,
                projectGeneration: generation, projectPath: '/current',
            };
        });
        mocks.restore.mockResolvedValue(true);
        mocks.openProject.mockResolvedValue({ status: 'opened-current' });
    });

    it('starts restoring the cached handle during the click before opening the project', async () => {
        let finishRestore!: (granted: boolean) => void;
        mocks.restore.mockImplementation(() => new Promise(resolve => { finishRestore = resolve; }));

        const opening = openRecentProject('/cached/game.json');

        expect(mocks.restore).toHaveBeenCalledWith('/cached/game.json');
        expect(mocks.openProject).not.toHaveBeenCalled();
        finishRestore(true);
        expect(await opening).toEqual({ status: 'opened-current' });
        const request = mocks.beginRequest.mock.results[0];
        if (request.type !== 'return') throw new Error('Open request was not captured');
        expect(mocks.openProject).toHaveBeenCalledWith('/cached/game.json', { request: request.value });
    });

    it('leaves the active project untouched when the browser permission prompt is aborted', async () => {
        mocks.restore.mockResolvedValue(false);

        expect(await openRecentProject('/cached/game.json')).toEqual({ status: 'cancelled' });
        expect(mocks.openProject).not.toHaveBeenCalled();
        expect(mocks.announceOperationStatus).not.toHaveBeenCalled();
    });

    it.each([
        new Error('Folder access was denied'),
        new DOMException('game.json is missing', 'NotFoundError'),
        new SyntaxError('Invalid project JSON'),
    ])('reports a recoverable restore failure without opening or logging an error: %s', async (error) => {
        mocks.restore.mockRejectedValue(error);
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

        try {
            expect(await openRecentProject('/cached/game.json')).toEqual({ status: 'cancelled' });
            expect(mocks.openProject).not.toHaveBeenCalled();
            expect(mocks.announceOperationStatus).toHaveBeenCalledWith(
                expect.stringContaining(error.message), 'error',
            );
            expect(consoleError).not.toHaveBeenCalled();
        } finally {
            consoleError.mockRestore();
        }
    });

    it('passes project-switch cancellation back to the recent-project UI', async () => {
        mocks.openProject.mockResolvedValue({ status: 'cancelled' });

        expect(await openRecentProject('/cached/game.json')).toEqual({ status: 'cancelled' });
        expect(mocks.announceOperationStatus).not.toHaveBeenCalled();
    });

    it('ignores an older permission completion after a newer selection opens', async () => {
        let finish!: (granted: boolean) => void;
        mocks.restore.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
        const older = openRecentProject('/older/game.json');
        expect(await openRecentProject('/newer/game.json')).toEqual({ status: 'opened-current' });
        finish(true);
        expect(await older).toEqual({ status: 'cancelled' });
        expect(mocks.openProject).toHaveBeenCalledTimes(1);
        const request = mocks.beginRequest.mock.results[1];
        if (request.type !== 'return') throw new Error('Newer open request was not captured');
        expect(mocks.openProject).toHaveBeenCalledWith('/newer/game.json', { request: request.value });
        expect(mocks.announceOperationStatus).not.toHaveBeenCalled();
    });

    it('does not open a restored project after the active session closes or changes', async () => {
        let finish!: (granted: boolean) => void;
        mocks.restore.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
        const opening = openRecentProject('/older/game.json');
        mocks.generation++;
        finish(true);
        expect(await opening).toEqual({ status: 'cancelled' });
        expect(mocks.openProject).not.toHaveBeenCalled();
    });

    it('ignores an older restore error after another open request starts', async () => {
        let fail!: (error: Error) => void;
        mocks.restore.mockReturnValueOnce(new Promise((_resolve, reject) => { fail = reject; }));
        const opening = openRecentProject('/older/game.json');
        mocks.beginRequest();
        fail(new Error('Stale permission error'));
        expect(await opening).toEqual({ status: 'cancelled' });
        expect(mocks.openProject).not.toHaveBeenCalled();
        expect(mocks.announceOperationStatus).not.toHaveBeenCalled();
    });

    it('preserves the desktop recent-project flow without restoring a browser handle', async () => {
        mocks.isTauriRuntime.mockReturnValue(true);
        mocks.openProject.mockResolvedValue({ status: 'opened-new-window' });

        expect(await openRecentProject('C:/Games/Native/game.json')).toEqual({ status: 'opened-new-window' });
        expect(mocks.restore).not.toHaveBeenCalled();
        expect(mocks.openProject).toHaveBeenCalledWith('C:/Games/Native/game.json');
    });
});
