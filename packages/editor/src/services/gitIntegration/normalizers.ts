import type {
    NativeGitBranchEntry,
    NativeGitBranchSummaryResponse,
    NativeGitCheckoutBranchResponse,
    NativeGitCommitStagedResponse,
    NativeGitCreateBranchResponse,
    NativeGitDiffFileResponse,
    NativeGitDiffFileSummary,
    NativeGitDiffSummaryResponse,
    NativeGitFileActionResponse,
    NativeGitInitRepositoryResponse,
    NativeGitPushCurrentBranchResponse,
    NativeGitRemoteEntry,
    NativeGitRemoteSummaryResponse,
    NativeGitStageAllResponse,
    NativeGitStatusEntry,
    NativeGitStatusResponse,
} from './nativeTypes';
import type {
    GitBranchEntry,
    GitBranchSummarySnapshot,
    GitDiffFileSnapshot,
    GitDiffFileSummary,
    GitDiffSummarySnapshot,
    GitInitRepositorySnapshot,
    GitRemoteEntry,
    GitRemoteSummarySnapshot,
    GitStatusEntry,
    GitStatusSnapshot,
} from './types';

export function normalizeGitBranchSummaryResponse(response: NativeGitBranchSummaryResponse): GitBranchSummarySnapshot {
    const branches = normalizeBranchEntries(response.branches);
    return {
        branches,
        current: normalizeOptionalString(response.current) ?? branches.find((branch) => branch.current)?.name,
        isRepository: response.isRepository === true,
        rawBranches: typeof response.rawBranches === 'string' ? response.rawBranches : '',
        repositoryRoot: normalizeOptionalString(response.repositoryRoot),
    };
}

export function normalizeGitCheckoutBranchResponse(response: NativeGitCheckoutBranchResponse): {
    branchName?: string;
    isRepository: boolean;
    rawOutput: string;
    repositoryRoot?: string;
} {
    return {
        branchName: normalizeOptionalString(response.branchName),
        isRepository: response.isRepository === true,
        rawOutput: typeof response.rawOutput === 'string' ? response.rawOutput : '',
        repositoryRoot: normalizeOptionalString(response.repositoryRoot),
    };
}

export function normalizeGitCommitStagedResponse(response: NativeGitCommitStagedResponse): {
    commitHash?: string;
    isRepository: boolean;
    rawOutput: string;
    repositoryRoot?: string;
} {
    return {
        commitHash: normalizeOptionalString(response.commitHash),
        isRepository: response.isRepository === true,
        rawOutput: typeof response.rawOutput === 'string' ? response.rawOutput : '',
        repositoryRoot: normalizeOptionalString(response.repositoryRoot),
    };
}

export function normalizeGitCreateBranchResponse(response: NativeGitCreateBranchResponse): {
    branchName?: string;
    isRepository: boolean;
    rawOutput: string;
    repositoryRoot?: string;
} {
    return {
        branchName: normalizeOptionalString(response.branchName),
        isRepository: response.isRepository === true,
        rawOutput: typeof response.rawOutput === 'string' ? response.rawOutput : '',
        repositoryRoot: normalizeOptionalString(response.repositoryRoot),
    };
}

export function normalizeGitDiffFileResponse(response: NativeGitDiffFileResponse): GitDiffFileSnapshot {
    return {
        isRepository: response.isRepository === true,
        path: normalizeOptionalString(response.path) ?? '',
        rawDiff: typeof response.rawDiff === 'string' ? response.rawDiff : '',
        repositoryRoot: normalizeOptionalString(response.repositoryRoot),
    };
}

export function normalizeGitDiffSummaryResponse(response: NativeGitDiffSummaryResponse): GitDiffSummarySnapshot {
    return {
        files: normalizeDiffFiles(response.files),
        isRepository: response.isRepository === true,
        rawNumstat: typeof response.rawNumstat === 'string' ? response.rawNumstat : '',
    };
}

export function normalizeGitFileActionResponse(response: NativeGitFileActionResponse): {
    isRepository: boolean;
    path?: string;
    rawOutput: string;
    repositoryRoot?: string;
    stagedCount: number;
} {
    return {
        isRepository: response.isRepository === true,
        path: normalizeOptionalString(response.path),
        rawOutput: typeof response.rawOutput === 'string' ? response.rawOutput : '',
        repositoryRoot: normalizeOptionalString(response.repositoryRoot),
        stagedCount: normalizeCount(response.stagedCount),
    };
}

export function normalizeGitInitRepositoryResponse(response: NativeGitInitRepositoryResponse): GitInitRepositorySnapshot {
    return {
        initialized: response.initialized === true,
        isRepository: response.isRepository === true,
        rawOutput: typeof response.rawOutput === 'string' ? response.rawOutput : '',
        repositoryRoot: normalizeOptionalString(response.repositoryRoot),
    };
}

export function normalizeGitPushCurrentBranchResponse(response: NativeGitPushCurrentBranchResponse): {
    branchName?: string;
    dryRun: boolean;
    isRepository: boolean;
    rawOutput: string;
    remoteName?: string;
    repositoryRoot?: string;
} {
    return {
        branchName: normalizeOptionalString(response.branchName),
        dryRun: response.dryRun === true,
        isRepository: response.isRepository === true,
        rawOutput: typeof response.rawOutput === 'string' ? response.rawOutput : '',
        remoteName: normalizeOptionalString(response.remoteName),
        repositoryRoot: normalizeOptionalString(response.repositoryRoot),
    };
}

export function normalizeGitRemoteSummaryResponse(response: NativeGitRemoteSummaryResponse): GitRemoteSummarySnapshot {
    return {
        isRepository: response.isRepository === true,
        rawRemotes: typeof response.rawRemotes === 'string' ? response.rawRemotes : '',
        remotes: normalizeGitRemoteEntries(response.remotes),
        repositoryRoot: normalizeOptionalString(response.repositoryRoot),
    };
}

export function normalizeGitStageAllResponse(response: NativeGitStageAllResponse): {
    isRepository: boolean;
    rawOutput: string;
    repositoryRoot?: string;
    stagedCount: number;
} {
    return {
        isRepository: response.isRepository === true,
        rawOutput: typeof response.rawOutput === 'string' ? response.rawOutput : '',
        repositoryRoot: normalizeOptionalString(response.repositoryRoot),
        stagedCount: normalizeCount(response.stagedCount),
    };
}

export function normalizeGitStatusResponse(response: NativeGitStatusResponse): GitStatusSnapshot {
    return {
        ahead: normalizeCount(response.ahead),
        behind: normalizeCount(response.behind),
        branch: normalizeOptionalString(response.branch),
        entries: normalizeEntries(response.entries),
        isRepository: response.isRepository === true,
        rawStatus: typeof response.rawStatus === 'string' ? response.rawStatus : '',
        repositoryRoot: normalizeOptionalString(response.repositoryRoot),
    };
}

function normalizeBranchEntries(entries: unknown): GitBranchEntry[] {
    if (!Array.isArray(entries)) return [];

    return entries
        .map((entry) => normalizeBranchEntry(entry))
        .filter((entry): entry is GitBranchEntry => entry !== undefined);
}

function normalizeBranchEntry(entry: unknown): GitBranchEntry | undefined {
    if (!entry || typeof entry !== 'object') return undefined;

    const candidate = entry as NativeGitBranchEntry;
    const name = normalizeOptionalString(candidate.name);
    if (!name) return undefined;
    const upstream = normalizeOptionalString(candidate.upstream);

    return {
        current: candidate.current === true,
        name,
        ...(upstream === undefined ? {} : { upstream }),
    };
}

function normalizeCount(value: unknown): number {
    return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

function normalizeDiffFile(entry: unknown): GitDiffFileSummary | undefined {
    if (!entry || typeof entry !== 'object') return undefined;

    const candidate = entry as NativeGitDiffFileSummary;
    const path = normalizeOptionalString(candidate.path);
    if (!path) return undefined;

    return {
        binary: candidate.binary === true,
        deletions: normalizeCount(candidate.deletions),
        insertions: normalizeCount(candidate.insertions),
        path,
    };
}

function normalizeDiffFiles(files: unknown): GitDiffFileSummary[] {
    if (!Array.isArray(files)) return [];

    return files.map((file) => normalizeDiffFile(file)).filter((file): file is GitDiffFileSummary => file !== undefined);
}

function normalizeEntries(entries: unknown): GitStatusEntry[] {
    if (!Array.isArray(entries)) return [];

    return entries.map((entry) => normalizeEntry(entry)).filter((entry): entry is GitStatusEntry => entry !== undefined);
}

function normalizeEntry(entry: unknown): GitStatusEntry | undefined {
    if (!entry || typeof entry !== 'object') return undefined;

    const candidate = entry as NativeGitStatusEntry;
    const path = normalizeOptionalString(candidate.path);
    if (!path) return undefined;

    return {
        index: normalizeStatusCode(candidate.index),
        path,
        workingTree: normalizeStatusCode(candidate.workingTree),
    };
}

function normalizeGitRemoteEntries(entries: unknown): GitRemoteEntry[] {
    if (!Array.isArray(entries)) return [];

    return entries
        .map((entry) => normalizeGitRemoteEntry(entry))
        .filter((entry): entry is GitRemoteEntry => entry !== undefined);
}

function normalizeGitRemoteEntry(entry: unknown): GitRemoteEntry | undefined {
    if (!entry || typeof entry !== 'object') return undefined;

    const candidate = entry as NativeGitRemoteEntry;
    const name = normalizeOptionalString(candidate.name);
    if (!name) return undefined;
    const fetchUrl = normalizeOptionalString(candidate.fetchUrl);
    const pushUrl = normalizeOptionalString(candidate.pushUrl);

    return {
        ...(fetchUrl === undefined ? {} : { fetchUrl }),
        name,
        ...(pushUrl === undefined ? {} : { pushUrl }),
    };
}

function normalizeOptionalString(value: unknown): string | undefined {
    if (typeof value !== 'string') return undefined;

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeStatusCode(value: unknown): string {
    if (typeof value !== 'string' || value.length === 0) return ' ';
    return value.slice(0, 1);
}
