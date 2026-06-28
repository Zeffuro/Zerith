import { describe, expect, it } from 'vitest';

import {
    createGitBranchReport,
    createGitBranchSummaryReport,
    createGitCheckoutBranchReport,
    createGitCommitStagedReport,
    createGitDiffFileReport,
    createGitDiffSummaryReport,
    createGitInitRepositoryReport,
    createGitPushCurrentBranchReport,
    createGitRemoteSummaryReport,
    createGitStageAllReport,
    createGitStageFileReport,
    createGitStatusReport,
    createGitUnstageFileReport,
} from '../gitIntegration';

describe('gitIntegration', () => {
    it('reports browser git branch creation as unsupported without invoking Tauri', async () => {
        let wasInvoked = false;
        const invoke = <T>() => {
            wasInvoked = true;
            return Promise.resolve({} as T);
        };

        const report = await createGitBranchReport('/project', 'feature/audio', {
            invoke,
            isTauriRuntime: () => false,
        });

        expect(report).toEqual({
            reason: 'Git branch creation is disabled in browser builds until repository access and project-handle persistence are designed.',
            runtime: 'browser',
            status: 'unsupported',
        });
        expect(wasInvoked).toBe(false);
    });

    it('reports missing branch names before invoking Tauri', async () => {
        let wasInvoked = false;
        const invoke = <T>() => {
            wasInvoked = true;
            return Promise.resolve({} as T);
        };

        const report = await createGitBranchReport('/project', ' ', {
            invoke,
            isTauriRuntime: () => true,
        });

        expect(report).toEqual({
            reason: 'Branch name is required.',
            runtime: 'desktop',
            status: 'error',
        });
        expect(wasInvoked).toBe(false);
    });

    it('invokes the desktop git branch creation command and normalizes the response', async () => {
        const nativeResponse = {
            branchName: ' feature/audio ',
            isRepository: true,
            rawOutput: '',
            repositoryRoot: ' /repo ',
        };
        const invokeCalls: Array<{ arguments_?: Record<string, unknown>; command: string; }> = [];
        const invoke = <T>(command: string, arguments_?: Record<string, unknown>) => {
            invokeCalls.push({ arguments_, command });
            return Promise.resolve(nativeResponse as T);
        };

        const report = await createGitBranchReport(' /repo/game ', ' feature/audio ', {
            invoke,
            isTauriRuntime: () => true,
        });

        expect(invokeCalls).toEqual([
            {
                arguments_: { request: { branchName: 'feature/audio', projectPath: '/repo/game' } },
                command: 'git_create_branch',
            },
        ]);
        expect(report).toEqual({
            branchName: 'feature/audio',
            rawOutput: '',
            repositoryRoot: '/repo',
            runtime: 'desktop',
            status: 'created',
        });
    });

    it('reports non-repository branch creation responses without treating them as successful', async () => {
        const report = await createGitBranchReport('/project', 'feature/audio', {
            invoke: <T>() => Promise.resolve({ isRepository: false } as T),
            isTauriRuntime: () => true,
        });

        expect(report).toEqual({
            reason: 'Git repository: none found for /project',
            runtime: 'desktop',
            status: 'not-repository',
        });
    });

    it('reports browser git repository initialization as unsupported without invoking Tauri', async () => {
        let wasInvoked = false;
        const invoke = <T>() => {
            wasInvoked = true;
            return Promise.resolve({} as T);
        };

        const report = await createGitInitRepositoryReport('/project', {
            invoke,
            isTauriRuntime: () => false,
        });

        expect(report).toEqual({
            reason: 'Git repository initialization is disabled in browser builds until repository access and project-handle persistence are designed.',
            runtime: 'browser',
            status: 'unsupported',
        });
        expect(wasInvoked).toBe(false);
    });

    it('invokes the desktop git repository initialization command and normalizes the response', async () => {
        const nativeResponse = {
            initialized: true,
            isRepository: true,
            rawOutput: 'Initialized empty Git repository',
            repositoryRoot: ' /repo/game ',
        };
        const invokeCalls: Array<{ arguments_?: Record<string, unknown>; command: string; }> = [];
        const invoke = <T>(command: string, arguments_?: Record<string, unknown>) => {
            invokeCalls.push({ arguments_, command });
            return Promise.resolve(nativeResponse as T);
        };

        const report = await createGitInitRepositoryReport(' /repo/game ', {
            invoke,
            isTauriRuntime: () => true,
        });

        expect(invokeCalls).toEqual([
            {
                arguments_: { request: { projectPath: '/repo/game' } },
                command: 'git_init_repository',
            },
        ]);
        expect(report).toEqual({
            initialized: true,
            isRepository: true,
            rawOutput: 'Initialized empty Git repository',
            repositoryRoot: '/repo/game',
            runtime: 'desktop',
            status: 'initialized',
        });
    });

    it('reports browser git checkout as unsupported without invoking Tauri', async () => {
        let wasInvoked = false;
        const invoke = <T>() => {
            wasInvoked = true;
            return Promise.resolve({} as T);
        };

        const report = await createGitCheckoutBranchReport('/project', 'main', {
            invoke,
            isTauriRuntime: () => false,
        });

        expect(report).toEqual({
            reason: 'Git checkout is disabled in browser builds until repository access and project-handle persistence are designed.',
            runtime: 'browser',
            status: 'unsupported',
        });
        expect(wasInvoked).toBe(false);
    });

    it('invokes the desktop git checkout command and normalizes the response', async () => {
        const nativeResponse = {
            branchName: ' main ',
            isRepository: true,
            rawOutput: 'Switched to branch main',
            repositoryRoot: ' /repo ',
        };
        const invokeCalls: Array<{ arguments_?: Record<string, unknown>; command: string; }> = [];
        const invoke = <T>(command: string, arguments_?: Record<string, unknown>) => {
            invokeCalls.push({ arguments_, command });
            return Promise.resolve(nativeResponse as T);
        };

        const report = await createGitCheckoutBranchReport(' /repo/game ', ' main ', {
            invoke,
            isTauriRuntime: () => true,
        });

        expect(invokeCalls).toEqual([
            {
                arguments_: { request: { branchName: 'main', projectPath: '/repo/game' } },
                command: 'git_checkout_branch',
            },
        ]);
        expect(report).toEqual({
            branchName: 'main',
            rawOutput: 'Switched to branch main',
            repositoryRoot: '/repo',
            runtime: 'desktop',
            status: 'checked-out',
        });
    });

    it('reports non-repository checkout responses without treating them as successful', async () => {
        const report = await createGitCheckoutBranchReport('/project', 'main', {
            invoke: <T>() => Promise.resolve({ isRepository: false } as T),
            isTauriRuntime: () => true,
        });

        expect(report).toEqual({
            reason: 'Git repository: none found for /project',
            runtime: 'desktop',
            status: 'not-repository',
        });
    });

    it('reports browser git commits as unsupported without invoking Tauri', async () => {
        let wasInvoked = false;
        const invoke = <T>() => {
            wasInvoked = true;
            return Promise.resolve({} as T);
        };

        const report = await createGitCommitStagedReport('/project', 'Update intro', {
            invoke,
            isTauriRuntime: () => false,
        });

        expect(report).toEqual({
            reason: 'Git commit is disabled in browser builds until repository access and project-handle persistence are designed.',
            runtime: 'browser',
            status: 'unsupported',
        });
        expect(wasInvoked).toBe(false);
    });

    it('reports missing commit messages before invoking Tauri', async () => {
        let wasInvoked = false;
        const invoke = <T>() => {
            wasInvoked = true;
            return Promise.resolve({} as T);
        };

        const report = await createGitCommitStagedReport('/project', ' ', {
            invoke,
            isTauriRuntime: () => true,
        });

        expect(report).toEqual({
            reason: 'Commit message is required.',
            runtime: 'desktop',
            status: 'error',
        });
        expect(wasInvoked).toBe(false);
    });

    it('invokes the desktop staged commit command and normalizes the response', async () => {
        const nativeResponse = {
            commitHash: ' abc1234 ',
            isRepository: true,
            rawOutput: '[main abc1234] Update intro',
            repositoryRoot: ' /repo ',
        };
        const invokeCalls: Array<{ arguments_?: Record<string, unknown>; command: string; }> = [];
        const invoke = <T>(command: string, arguments_?: Record<string, unknown>) => {
            invokeCalls.push({ arguments_, command });
            return Promise.resolve(nativeResponse as T);
        };

        const report = await createGitCommitStagedReport(' /repo/game ', ' Update intro ', {
            invoke,
            isTauriRuntime: () => true,
        });

        expect(invokeCalls).toEqual([
            {
                arguments_: { request: { message: 'Update intro', projectPath: '/repo/game' } },
                command: 'git_commit_staged',
            },
        ]);
        expect(report).toEqual({
            commitHash: 'abc1234',
            rawOutput: '[main abc1234] Update intro',
            repositoryRoot: '/repo',
            runtime: 'desktop',
            status: 'committed',
        });
    });

    it('passes optional commit descriptions to the staged commit command', async () => {
        const nativeResponse = {
            commitHash: ' abc1234 ',
            isRepository: true,
            rawOutput: '[main abc1234] Update intro',
        };
        const invokeCalls: Array<{ arguments_?: Record<string, unknown>; command: string; }> = [];
        const invoke = <T>(command: string, arguments_?: Record<string, unknown>) => {
            invokeCalls.push({ arguments_, command });
            return Promise.resolve(nativeResponse as T);
        };

        const report = await createGitCommitStagedReport(' /repo/game ', ' Update intro ', {
            description: ' Adds localized intro copy. ',
        }, {
            invoke,
            isTauriRuntime: () => true,
        });

        expect(invokeCalls).toEqual([
            {
                arguments_: {
                    request: {
                        description: 'Adds localized intro copy.',
                        message: 'Update intro',
                        projectPath: '/repo/game',
                    },
                },
                command: 'git_commit_staged',
            },
        ]);
        expect(report.status).toBe('committed');
    });

    it('reports non-repository staged commit responses without treating them as successful', async () => {
        const report = await createGitCommitStagedReport('/project', 'Update intro', {
            invoke: <T>() => Promise.resolve({ isRepository: false } as T),
            isTauriRuntime: () => true,
        });

        expect(report).toEqual({
            reason: 'Git repository: none found for /project',
            runtime: 'desktop',
            status: 'not-repository',
        });
    });

    it('invokes the desktop git file staging command and normalizes the response', async () => {
        const nativeResponse = {
            isRepository: true,
            path: ' scripts/intro.json ',
            rawOutput: '',
            repositoryRoot: ' /repo ',
            stagedCount: 3,
        };
        const invokeCalls: Array<{ arguments_?: Record<string, unknown>; command: string; }> = [];
        const invoke = <T>(command: string, arguments_?: Record<string, unknown>) => {
            invokeCalls.push({ arguments_, command });
            return Promise.resolve(nativeResponse as T);
        };

        const report = await createGitStageFileReport(' /repo/game ', ' scripts/intro.json ', {
            invoke,
            isTauriRuntime: () => true,
        });

        expect(invokeCalls).toEqual([
            {
                arguments_: { request: { path: 'scripts/intro.json', projectPath: '/repo/game' } },
                command: 'git_stage_file',
            },
        ]);
        expect(report).toEqual({
            path: 'scripts/intro.json',
            rawOutput: '',
            repositoryRoot: '/repo',
            runtime: 'desktop',
            stagedCount: 3,
            status: 'staged',
        });
    });

    it('invokes the desktop git file unstaging command and normalizes the response', async () => {
        const nativeResponse = {
            isRepository: true,
            path: ' scripts/intro.json ',
            rawOutput: '',
            stagedCount: 2,
        };
        const invokeCalls: Array<{ arguments_?: Record<string, unknown>; command: string; }> = [];
        const invoke = <T>(command: string, arguments_?: Record<string, unknown>) => {
            invokeCalls.push({ arguments_, command });
            return Promise.resolve(nativeResponse as T);
        };

        const report = await createGitUnstageFileReport(' /repo/game ', ' scripts/intro.json ', {
            invoke,
            isTauriRuntime: () => true,
        });

        expect(invokeCalls).toEqual([
            {
                arguments_: { request: { path: 'scripts/intro.json', projectPath: '/repo/game' } },
                command: 'git_unstage_file',
            },
        ]);
        expect(report).toEqual({
            path: 'scripts/intro.json',
            rawOutput: '',
            runtime: 'desktop',
            stagedCount: 2,
            status: 'unstaged',
        });
    });

    it('reports browser git branch summaries as unsupported without invoking Tauri', async () => {
        let wasInvoked = false;
        const invoke = <T>() => {
            wasInvoked = true;
            return Promise.resolve({} as T);
        };

        const report = await createGitBranchSummaryReport('/project', {
            invoke,
            isTauriRuntime: () => false,
        });

        expect(report).toEqual({
            reason: 'Git branch summary is disabled in browser builds until repository access and project-handle persistence are designed.',
            runtime: 'browser',
            status: 'unsupported',
        });
        expect(wasInvoked).toBe(false);
    });

    it('invokes the desktop git branch summary command and normalizes the response', async () => {
        const nativeResponse = {
            branches: [
                { current: true, name: ' main ', upstream: ' origin/main ' },
                { current: false, name: 'feature/audio' },
                { current: false, upstream: 'origin/missing-name' },
            ],
            isRepository: true,
            rawBranches: '*\tmain\torigin/main\n \tfeature/audio\t',
            repositoryRoot: ' /repo ',
        };
        const invokeCalls: Array<{ arguments_?: Record<string, unknown>; command: string; }> = [];
        const invoke = <T>(command: string, arguments_?: Record<string, unknown>) => {
            invokeCalls.push({ arguments_, command });
            return Promise.resolve(nativeResponse as T);
        };

        const report = await createGitBranchSummaryReport(' /repo/game ', {
            invoke,
            isTauriRuntime: () => true,
        });

        expect(invokeCalls).toEqual([
            {
                arguments_: { request: { projectPath: '/repo/game' } },
                command: 'git_branch_summary',
            },
        ]);
        expect(report).toEqual({
            branches: [
                { current: true, name: 'main', upstream: 'origin/main' },
                { current: false, name: 'feature/audio' },
            ],
            current: 'main',
            isRepository: true,
            rawBranches: '*\tmain\torigin/main\n \tfeature/audio\t',
            repositoryRoot: '/repo',
            runtime: 'desktop',
            status: 'ready',
        });
    });

    it('reports browser git diff summaries as unsupported without invoking Tauri', async () => {
        let wasInvoked = false;
        const invoke = <T>() => {
            wasInvoked = true;
            return Promise.resolve({} as T);
        };

        const report = await createGitDiffSummaryReport('/project', {
            invoke,
            isTauriRuntime: () => false,
        });

        expect(report).toEqual({
            reason: 'Git diff summary is disabled in browser builds until repository access and project-handle persistence are designed.',
            runtime: 'browser',
            status: 'unsupported',
        });
        expect(wasInvoked).toBe(false);
    });

    it('reports missing git file diff paths before invoking Tauri', async () => {
        let wasInvoked = false;
        const invoke = <T>() => {
            wasInvoked = true;
            return Promise.resolve({} as T);
        };

        const report = await createGitDiffFileReport('/project', ' ', {
            invoke,
            isTauriRuntime: () => true,
        });

        expect(report).toEqual({
            reason: 'Git file path is required.',
            runtime: 'desktop',
            status: 'error',
        });
        expect(wasInvoked).toBe(false);
    });

    it('reports browser git file diffs as unsupported without invoking Tauri', async () => {
        let wasInvoked = false;
        const invoke = <T>() => {
            wasInvoked = true;
            return Promise.resolve({} as T);
        };

        const report = await createGitDiffFileReport('/project', 'scripts/intro.json', {
            invoke,
            isTauriRuntime: () => false,
        });

        expect(report).toEqual({
            reason: 'Git file diffs are disabled in browser builds until repository access and project-handle persistence are designed.',
            runtime: 'browser',
            status: 'unsupported',
        });
        expect(wasInvoked).toBe(false);
    });

    it('invokes the desktop git file diff command and normalizes the response', async () => {
        const nativeResponse = {
            isRepository: true,
            path: ' scripts/intro.json ',
            rawDiff: 'diff --git a/scripts/intro.json b/scripts/intro.json',
            repositoryRoot: ' /repo ',
        };
        const invokeCalls: Array<{ arguments_?: Record<string, unknown>; command: string; }> = [];
        const invoke = <T>(command: string, arguments_?: Record<string, unknown>) => {
            invokeCalls.push({ arguments_, command });
            return Promise.resolve(nativeResponse as T);
        };

        const report = await createGitDiffFileReport(' /repo/game ', ' scripts/intro.json ', {
            invoke,
            isTauriRuntime: () => true,
        });

        expect(invokeCalls).toEqual([
            {
                arguments_: { request: { path: 'scripts/intro.json', projectPath: '/repo/game' } },
                command: 'git_diff_file',
            },
        ]);
        expect(report).toEqual({
            isRepository: true,
            path: 'scripts/intro.json',
            rawDiff: 'diff --git a/scripts/intro.json b/scripts/intro.json',
            repositoryRoot: '/repo',
            runtime: 'desktop',
            status: 'ready',
        });
    });

    it('invokes the desktop git diff summary command and normalizes the response', async () => {
        const nativeResponse = {
            files: [
                { binary: false, deletions: 2, insertions: 5, path: ' scripts/intro.json ' },
                { binary: true, deletions: '-', insertions: '-', path: 'assets/bg/title.png' },
                { insertions: 1 },
            ],
            isRepository: true,
            rawNumstat: '5\t2\tscripts/intro.json',
        };
        const invokeCalls: Array<{ arguments_?: Record<string, unknown>; command: string; }> = [];
        const invoke = <T>(command: string, arguments_?: Record<string, unknown>) => {
            invokeCalls.push({ arguments_, command });
            return Promise.resolve(nativeResponse as T);
        };

        const report = await createGitDiffSummaryReport(' /repo/game ', {
            invoke,
            isTauriRuntime: () => true,
        });

        expect(invokeCalls).toEqual([
            {
                arguments_: { request: { projectPath: '/repo/game' } },
                command: 'git_diff_summary',
            },
        ]);
        expect(report).toEqual({
            files: [
                { binary: false, deletions: 2, insertions: 5, path: 'scripts/intro.json' },
                { binary: true, deletions: 0, insertions: 0, path: 'assets/bg/title.png' },
            ],
            isRepository: true,
            rawNumstat: '5\t2\tscripts/intro.json',
            runtime: 'desktop',
            status: 'ready',
        });
    });

    it('reports browser git staging as unsupported without invoking Tauri', async () => {
        let wasInvoked = false;
        const invoke = <T>() => {
            wasInvoked = true;
            return Promise.resolve({} as T);
        };

        const report = await createGitStageAllReport('/project', {
            invoke,
            isTauriRuntime: () => false,
        });

        expect(report).toEqual({
            reason: 'Git staging is disabled in browser builds until repository access and project-handle persistence are designed.',
            runtime: 'browser',
            status: 'unsupported',
        });
        expect(wasInvoked).toBe(false);
    });

    it('invokes the desktop git staging command and normalizes the response', async () => {
        const nativeResponse = {
            isRepository: true,
            rawOutput: 'staged',
            repositoryRoot: ' /repo ',
            stagedCount: 2.8,
        };
        const invokeCalls: Array<{ arguments_?: Record<string, unknown>; command: string; }> = [];
        const invoke = <T>(command: string, arguments_?: Record<string, unknown>) => {
            invokeCalls.push({ arguments_, command });
            return Promise.resolve(nativeResponse as T);
        };

        const report = await createGitStageAllReport(' /repo/game ', {
            invoke,
            isTauriRuntime: () => true,
        });

        expect(invokeCalls).toEqual([
            {
                arguments_: { request: { projectPath: '/repo/game' } },
                command: 'git_stage_all',
            },
        ]);
        expect(report).toEqual({
            rawOutput: 'staged',
            repositoryRoot: '/repo',
            runtime: 'desktop',
            stagedCount: 2,
            status: 'staged',
        });
    });

    it('reports non-repository staging responses without treating them as successful', async () => {
        const report = await createGitStageAllReport('/project', {
            invoke: <T>() => Promise.resolve({ isRepository: false } as T),
            isTauriRuntime: () => true,
        });

        expect(report).toEqual({
            reason: 'Git repository: none found for /project',
            runtime: 'desktop',
            status: 'not-repository',
        });
    });

    it('reports browser git remote summaries as unsupported without invoking Tauri', async () => {
        let wasInvoked = false;
        const invoke = <T>() => {
            wasInvoked = true;
            return Promise.resolve({} as T);
        };

        const report = await createGitRemoteSummaryReport('/project', {
            invoke,
            isTauriRuntime: () => false,
        });

        expect(report).toEqual({
            reason: 'Git remote summary is disabled in browser builds until repository access and project-handle persistence are designed.',
            runtime: 'browser',
            status: 'unsupported',
        });
        expect(wasInvoked).toBe(false);
    });

    it('invokes the desktop git remote summary command and normalizes the response', async () => {
        const nativeResponse = {
            isRepository: true,
            rawRemotes: 'origin\thttps://example.invalid/repo.git (fetch)',
            remotes: [
                { fetchUrl: ' https://example.invalid/repo.git ', name: ' origin ', pushUrl: ' git@example.invalid:repo.git ' },
                { fetchUrl: 'https://example.invalid/mirror.git', name: 'mirror' },
                { pushUrl: 'git@example.invalid:missing-name.git' },
            ],
            repositoryRoot: ' /repo ',
        };
        const invokeCalls: Array<{ arguments_?: Record<string, unknown>; command: string; }> = [];
        const invoke = <T>(command: string, arguments_?: Record<string, unknown>) => {
            invokeCalls.push({ arguments_, command });
            return Promise.resolve(nativeResponse as T);
        };

        const report = await createGitRemoteSummaryReport(' /repo/game ', {
            invoke,
            isTauriRuntime: () => true,
        });

        expect(invokeCalls).toEqual([
            {
                arguments_: { request: { projectPath: '/repo/game' } },
                command: 'git_remote_summary',
            },
        ]);
        expect(report).toEqual({
            isRepository: true,
            rawRemotes: 'origin\thttps://example.invalid/repo.git (fetch)',
            remotes: [
                {
                    fetchUrl: 'https://example.invalid/repo.git',
                    name: 'origin',
                    pushUrl: 'git@example.invalid:repo.git',
                },
                {
                    fetchUrl: 'https://example.invalid/mirror.git',
                    name: 'mirror',
                },
            ],
            repositoryRoot: '/repo',
            runtime: 'desktop',
            status: 'ready',
        });
    });

    it('reports browser git push as unsupported without invoking Tauri', async () => {
        let wasInvoked = false;
        const invoke = <T>() => {
            wasInvoked = true;
            return Promise.resolve({} as T);
        };

        const report = await createGitPushCurrentBranchReport('/project', {
            remoteName: 'origin',
        }, {
            invoke,
            isTauriRuntime: () => false,
        });

        expect(report).toEqual({
            reason: 'Git push is disabled in browser builds until repository access and credential policy are designed.',
            runtime: 'browser',
            status: 'unsupported',
        });
        expect(wasInvoked).toBe(false);
    });

    it('reports missing git push remotes before invoking Tauri', async () => {
        let wasInvoked = false;
        const invoke = <T>() => {
            wasInvoked = true;
            return Promise.resolve({} as T);
        };

        const report = await createGitPushCurrentBranchReport('/project', {
            remoteName: ' ',
        }, {
            invoke,
            isTauriRuntime: () => true,
        });

        expect(report).toEqual({
            reason: 'Remote name is required.',
            runtime: 'desktop',
            status: 'error',
        });
        expect(wasInvoked).toBe(false);
    });

    it('invokes the desktop current-branch push command and normalizes the response', async () => {
        const nativeResponse = {
            branchName: ' main ',
            dryRun: true,
            isRepository: true,
            rawOutput: 'Everything up-to-date',
            remoteName: ' origin ',
            repositoryRoot: ' /repo ',
        };
        const invokeCalls: Array<{ arguments_?: Record<string, unknown>; command: string; }> = [];
        const invoke = <T>(command: string, arguments_?: Record<string, unknown>) => {
            invokeCalls.push({ arguments_, command });
            return Promise.resolve(nativeResponse as T);
        };

        const report = await createGitPushCurrentBranchReport(' /repo/game ', {
            dryRun: true,
            remoteName: ' origin ',
        }, {
            invoke,
            isTauriRuntime: () => true,
        });

        expect(invokeCalls).toEqual([
            {
                arguments_: { request: { dryRun: true, projectPath: '/repo/game', remoteName: 'origin' } },
                command: 'git_push_current_branch',
            },
        ]);
        expect(report).toEqual({
            branchName: 'main',
            dryRun: true,
            rawOutput: 'Everything up-to-date',
            remoteName: 'origin',
            repositoryRoot: '/repo',
            runtime: 'desktop',
            status: 'pushed',
        });
    });

    it('reports non-repository git push responses without treating them as successful', async () => {
        const report = await createGitPushCurrentBranchReport('/project', {
            remoteName: 'origin',
        }, {
            invoke: <T>() => Promise.resolve({ isRepository: false } as T),
            isTauriRuntime: () => true,
        });

        expect(report).toEqual({
            reason: 'Git repository: none found for /project',
            runtime: 'desktop',
            status: 'not-repository',
        });
    });

    it('reports browser git status as unsupported without invoking Tauri', async () => {
        let wasInvoked = false;
        const invoke = <T>() => {
            wasInvoked = true;
            return Promise.resolve({} as T);
        };

        const report = await createGitStatusReport('/project', {
            invoke,
            isTauriRuntime: () => false,
        });

        expect(report).toEqual({
            reason: 'Git status is disabled in browser builds until repository access and project-handle persistence are designed.',
            runtime: 'browser',
            status: 'unsupported',
        });
        expect(wasInvoked).toBe(false);
    });

    it('reports missing project paths before invoking Tauri', async () => {
        let wasInvoked = false;
        const invoke = <T>() => {
            wasInvoked = true;
            return Promise.resolve({} as T);
        };

        const report = await createGitStatusReport('', {
            invoke,
            isTauriRuntime: () => true,
        });

        expect(report).toEqual({
            reason: 'No project is currently open.',
            runtime: 'desktop',
            status: 'error',
        });
        expect(wasInvoked).toBe(false);
    });

    it('invokes the desktop git status command and normalizes the response', async () => {
        const nativeResponse = {
            ahead: 2.8,
            behind: 1,
            branch: ' main ',
            entries: [
                { index: 'M', path: 'scripts/intro.json', workingTree: ' ' },
                { index: '??', path: ' notes/todo.txt ', workingTree: '?' },
                { index: 'M', workingTree: 'M' },
            ],
            isRepository: true,
            rawStatus: '## main...origin/main [ahead 2, behind 1]',
            repositoryRoot: ' /repo ',
        };
        const invokeCalls: Array<{ arguments_?: Record<string, unknown>; command: string; }> = [];
        const invoke = <T>(command: string, arguments_?: Record<string, unknown>) => {
            invokeCalls.push({ arguments_, command });
            return Promise.resolve(nativeResponse as T);
        };

        const report = await createGitStatusReport(' /repo/game ', {
            invoke,
            isTauriRuntime: () => true,
        });

        expect(invokeCalls).toEqual([
            {
                arguments_: { request: { projectPath: '/repo/game' } },
                command: 'git_status',
            },
        ]);
        expect(report).toEqual({
            ahead: 2,
            behind: 1,
            branch: 'main',
            entries: [
                { index: 'M', path: 'scripts/intro.json', workingTree: ' ' },
                { index: '?', path: 'notes/todo.txt', workingTree: '?' },
            ],
            isRepository: true,
            rawStatus: '## main...origin/main [ahead 2, behind 1]',
            repositoryRoot: '/repo',
            runtime: 'desktop',
            status: 'ready',
        });
    });

    it('returns shaped desktop errors when the backend rejects', async () => {
        const report = await createGitStatusReport('/repo/game', {
            invoke: <T>() => Promise.reject<T>(new Error('git is missing')),
            isTauriRuntime: () => true,
        });

        expect(report).toEqual({
            reason: 'git is missing',
            runtime: 'desktop',
            status: 'error',
        });
    });

    it('returns shaped desktop diff summary errors when the backend rejects', async () => {
        const report = await createGitDiffSummaryReport('/repo/game', {
            invoke: <T>() => Promise.reject<T>(new Error('diff failed')),
            isTauriRuntime: () => true,
        });

        expect(report).toEqual({
            reason: 'diff failed',
            runtime: 'desktop',
            status: 'error',
        });
    });
});
