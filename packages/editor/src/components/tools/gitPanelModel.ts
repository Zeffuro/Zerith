import type {
    GitDiffSummaryReport,
    GitRemoteEntry,
    GitRemoteSummaryReport,
    GitStatusEntry,
    GitStatusReport,
} from '../../services/gitIntegration';

import {
    createGitRemotePolicyReport,
    type GitRemotePolicyEntry,
    type GitRemotePolicyReport,
    type GitRemotePolicyStatus,
} from '../../services/gitIntegrationReport';

export type GitPanelChangeBuckets = {
    staged: GitStatusEntry[];
    unstaged: GitStatusEntry[];
};

export type GitPanelChangeSummary = {
    binaryFiles: number;
    deletions: number;
    insertions: number;
    staged: number;
    total: number;
    unstaged: number;
    untracked: number;
};

export type GitPanelPushPreflight = {
    canPush: boolean;
    credentialLabel: string;
    effectivePushUrl?: string;
    note: string;
    remoteName: string;
    status: 'unavailable' | GitRemotePolicyStatus;
};

export function createGitPanelChangeBuckets(statusReport: GitStatusReport | undefined): GitPanelChangeBuckets {
    const statusEntries = statusReport?.status === 'ready' && statusReport.isRepository
        ? statusReport.entries
        : [];

    return {
        staged: statusEntries.filter((entry) => isStagedGitEntry(entry)),
        unstaged: statusEntries.filter((entry) => isUnstagedGitEntry(entry)),
    };
}

export function createGitPanelChangeSummary(
    statusReport: GitStatusReport | undefined,
    diffReport: GitDiffSummaryReport | undefined,
): GitPanelChangeSummary {
    const buckets = createGitPanelChangeBuckets(statusReport);
    const statusEntries = [...buckets.staged, ...buckets.unstaged];
    const diffFiles = diffReport?.status === 'ready' && diffReport.isRepository
        ? diffReport.files
        : [];

    return {
        binaryFiles: diffFiles.filter((file) => file.binary).length,
        deletions: diffFiles.reduce((total, file) => total + file.deletions, 0),
        insertions: diffFiles.reduce((total, file) => total + file.insertions, 0),
        staged: buckets.staged.length,
        total: new Set(statusEntries.map((entry) => entry.path)).size,
        unstaged: buckets.unstaged.length,
        untracked: buckets.unstaged.filter((entry) => entry.index === '?' && entry.workingTree === '?').length,
    };
}

export function createGitPanelPushPreflight(
    remotes: readonly GitRemoteEntry[],
    policy: GitRemotePolicyReport | undefined,
    selectedRemoteName?: string,
): GitPanelPushPreflight {
    const remoteName = selectedRemoteName?.trim() || findDefaultGitRemote(remotes, policy);
    const policyEntry = findGitRemotePolicyEntry(policy, remoteName);

    if (!policyEntry) {
        return {
            canPush: false,
            credentialLabel: 'No remote policy',
            note: remotes.length > 0
                ? `No credential policy is available for '${remoteName}'.`
                : 'No Git remotes are configured for this repository.',
            remoteName,
            status: 'unavailable',
        };
    }

    return {
        canPush: policyEntry.status !== 'blocked',
        credentialLabel: `${policyEntry.transport} / ${policyEntry.credentialMode}`,
        effectivePushUrl: policyEntry.effectivePushUrl,
        note: policyEntry.note,
        remoteName: policyEntry.name,
        status: policyEntry.status,
    };
}

export function createGitPanelRemotePolicy(
    remoteReport: GitRemoteSummaryReport | undefined,
): GitRemotePolicyReport | undefined {
    if (remoteReport?.status !== 'ready' || !remoteReport.isRepository) {
        return undefined;
    }

    return createGitRemotePolicyReport(remoteReport.remotes);
}

export function findDefaultGitRemote(remotes: readonly GitRemoteEntry[], policy?: GitRemotePolicyReport): string {
    return policy?.recommendedRemote
        ?? remotes.find((remote) => remote.name === 'origin')?.name
        ?? remotes[0]?.name
        ?? 'origin';
}

export function formatGitBranchLabel(statusReport?: GitStatusReport): string {
    if (statusReport?.status !== 'ready') return 'Unavailable';
    if (!statusReport.isRepository) return 'No repository';
    return statusReport.branch ?? 'Detached HEAD';
}

export function formatGitStatusCode(entry: GitStatusEntry): string {
    return `${entry.index}${entry.workingTree}`;
}

function findGitRemotePolicyEntry(
    policy: GitRemotePolicyReport | undefined,
    remoteName: string,
): GitRemotePolicyEntry | undefined {
    return policy?.entries.find((entry) => entry.name === remoteName);
}

function isStagedGitEntry(entry: GitStatusEntry): boolean {
    return entry.index !== ' ' && entry.index !== '?';
}

function isUnstagedGitEntry(entry: GitStatusEntry): boolean {
    return entry.index === '?' || entry.workingTree !== ' ';
}
