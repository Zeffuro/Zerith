import { describe, expect, it } from 'vitest';

import type { GitDiffSummaryReport, GitRemoteSummaryReport, GitStatusReport } from '../../../services/gitIntegration';

import {
    createGitPanelChangeBuckets,
    createGitPanelChangeSummary,
    createGitPanelPushPreflight,
    createGitPanelRemotePolicy,
    findDefaultGitRemote,
    formatGitBranchLabel,
    formatGitStatusCode,
} from '../gitPanelModel';

describe('gitPanelModel', () => {
    it('summarizes staged, unstaged, untracked, and diff totals', () => {
        const statusReport: GitStatusReport = {
            ahead: 1,
            behind: 2,
            branch: 'main',
            entries: [
                { index: 'M', path: 'staged.ts', workingTree: ' ' },
                { index: ' ', path: 'unstaged.ts', workingTree: 'M' },
                { index: '?', path: 'new.ts', workingTree: '?' },
                { index: 'A', path: 'both.ts', workingTree: 'M' },
            ],
            isRepository: true,
            rawStatus: '',
            runtime: 'desktop',
            status: 'ready',
        };
        const diffReport: GitDiffSummaryReport = {
            files: [
                { binary: false, deletions: 2, insertions: 5, path: 'staged.ts' },
                { binary: true, deletions: 0, insertions: 0, path: 'image.png' },
            ],
            isRepository: true,
            rawNumstat: '',
            runtime: 'desktop',
            status: 'ready',
        };

        expect(createGitPanelChangeSummary(statusReport, diffReport)).toEqual({
            binaryFiles: 1,
            deletions: 2,
            insertions: 5,
            staged: 2,
            total: 4,
            unstaged: 3,
            untracked: 1,
        });
        expect(createGitPanelChangeBuckets(statusReport)).toEqual({
            staged: [
                { index: 'M', path: 'staged.ts', workingTree: ' ' },
                { index: 'A', path: 'both.ts', workingTree: 'M' },
            ],
            unstaged: [
                { index: ' ', path: 'unstaged.ts', workingTree: 'M' },
                { index: '?', path: 'new.ts', workingTree: '?' },
                { index: 'A', path: 'both.ts', workingTree: 'M' },
            ],
        });
    });

    it('formats branch and status labels for unavailable, detached, and ready states', () => {
        expect(formatGitBranchLabel()).toBe('Unavailable');
        expect(formatGitBranchLabel({
            ahead: 0,
            behind: 0,
            entries: [],
            isRepository: false,
            rawStatus: '',
            runtime: 'desktop',
            status: 'ready',
        })).toBe('No repository');
        expect(formatGitBranchLabel({
            ahead: 0,
            behind: 0,
            entries: [],
            isRepository: true,
            rawStatus: '',
            runtime: 'desktop',
            status: 'ready',
        })).toBe('Detached HEAD');
        expect(formatGitStatusCode({ index: 'M', path: 'file.ts', workingTree: ' ' })).toBe('M ');
    });

    it('builds remote policy and default remote names', () => {
        const remoteReport: GitRemoteSummaryReport = {
            isRepository: true,
            rawRemotes: '',
            remotes: [
                { fetchUrl: 'https://example.test/repo.git', name: 'origin' },
                { fetchUrl: 'git@example.test:repo.git', name: 'ssh' },
            ],
            runtime: 'desktop',
            status: 'ready',
        };
        const policy = createGitPanelRemotePolicy(remoteReport);

        expect(policy?.summary).toEqual({ blocked: 0, ready: 1, review: 1 });
        expect(findDefaultGitRemote(remoteReport.remotes, policy)).toBe('ssh');
        expect(findDefaultGitRemote([{ name: 'origin' }])).toBe('origin');
        expect(findDefaultGitRemote([])).toBe('origin');
    });

    it('builds push preflight details from remote policy', () => {
        const remoteReport: GitRemoteSummaryReport = {
            isRepository: true,
            rawRemotes: '',
            remotes: [
                { fetchUrl: 'https://example.invalid/repo.git', name: 'origin' },
                { fetchUrl: 'git@example.test:repo.git', name: 'ssh' },
                { name: 'missing' },
            ],
            runtime: 'desktop',
            status: 'ready',
        };
        const policy = createGitPanelRemotePolicy(remoteReport);

        expect(createGitPanelPushPreflight(remoteReport.remotes, policy)).toMatchObject({
            canPush: true,
            credentialLabel: 'ssh / ssh-agent',
            remoteName: 'ssh',
            status: 'ready',
        });
        expect(createGitPanelPushPreflight(remoteReport.remotes, policy, 'origin')).toMatchObject({
            canPush: true,
            credentialLabel: 'https / external-helper',
            effectivePushUrl: 'https://example.invalid/repo.git',
            remoteName: 'origin',
            status: 'review',
        });
        expect(createGitPanelPushPreflight(remoteReport.remotes, policy, 'missing')).toMatchObject({
            canPush: false,
            credentialLabel: 'missing / missing',
            remoteName: 'missing',
            status: 'blocked',
        });
    });
});
