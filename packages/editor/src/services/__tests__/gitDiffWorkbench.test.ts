import { beforeEach, describe, expect, it, vi } from 'vitest';

const workbenchOpenMocks = vi.hoisted(() => ({
    executeWorkbenchOpenAction: vi.fn(),
}));

vi.mock('../../store/actions/workbenchOpenActions', () => ({
    executeWorkbenchOpenAction: workbenchOpenMocks.executeWorkbenchOpenAction,
}));

import { openGitDiffWorkbenchTab } from '../gitDiffWorkbench';

describe('gitDiffWorkbench', () => {
    beforeEach(() => {
        workbenchOpenMocks.executeWorkbenchOpenAction.mockReset();
    });

    it('opens a read-only Git diff workbench tab', () => {
        const opened = openGitDiffWorkbenchTab({
            filePath: 'scenes/intro.json',
            projectPath: 'F:/project/',
            rawDiff: '+new line',
            repositoryRoot: 'F:/project',
        });

        expect(opened).toBe(true);
        expect(workbenchOpenMocks.executeWorkbenchOpenAction).toHaveBeenCalledWith({
            action: 'openTab',
            tab: {
                gitDiffFilePath: 'scenes/intro.json',
                gitDiffRepositoryRoot: 'F:/project',
                id: 'gitDiff::F:/project#git-diff/scenes/intro.json',
                kind: 'gitDiff',
                path: 'F:/project#git-diff/scenes/intro.json',
                textContent: '+new line',
                title: 'Diff: intro.json',
            },
        });
    });
});
