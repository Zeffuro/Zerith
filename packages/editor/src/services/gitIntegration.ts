import { isTauriRuntime } from './runtime/runtimeEnvironment';

export type GitBranchEntry = {
    current: boolean;
    name: string;
    upstream?: string;
};

export type GitBranchSummaryReport =
    | {
        reason: string;
        runtime: 'browser';
        status: 'unsupported';
    }
    | {
        reason: string;
        runtime: GitStatusRuntime;
        status: 'error';
    }
    | ({
        runtime: 'desktop';
        status: 'ready';
    } & GitBranchSummarySnapshot);

export type GitBranchSummarySnapshot = {
    branches: GitBranchEntry[];
    current?: string;
    isRepository: boolean;
    rawBranches: string;
    repositoryRoot?: string;
};

export type GitCheckoutBranchReport =
    | {
        reason: string;
        runtime: 'browser';
        status: 'unsupported';
    }
    | {
        reason: string;
        runtime: 'desktop';
        status: 'not-repository';
    }
    | {
        reason: string;
        runtime: GitStatusRuntime;
        status: 'error';
    }
    | ({
        runtime: 'desktop';
        status: 'checked-out';
    } & GitCheckoutBranchSnapshot);

export type GitCheckoutBranchSnapshot = {
    branchName: string;
    rawOutput: string;
    repositoryRoot?: string;
};

export type GitCommitStagedReport =
    | {
        reason: string;
        runtime: 'browser';
        status: 'unsupported';
    }
    | {
        reason: string;
        runtime: 'desktop';
        status: 'not-repository';
    }
    | {
        reason: string;
        runtime: GitStatusRuntime;
        status: 'error';
    }
    | ({
        runtime: 'desktop';
        status: 'committed';
    } & GitCommitStagedSnapshot);

export type GitCommitStagedSnapshot = {
    commitHash: string;
    rawOutput: string;
    repositoryRoot?: string;
};

export type GitCreateBranchReport =
    | {
        reason: string;
        runtime: 'browser';
        status: 'unsupported';
    }
    | {
        reason: string;
        runtime: 'desktop';
        status: 'not-repository';
    }
    | {
        reason: string;
        runtime: GitStatusRuntime;
        status: 'error';
    }
    | ({
        runtime: 'desktop';
        status: 'created';
    } & GitCreateBranchSnapshot);

export type GitCreateBranchSnapshot = {
    branchName: string;
    rawOutput: string;
    repositoryRoot?: string;
};

export type GitDiffFileSummary = {
    binary: boolean;
    deletions: number;
    insertions: number;
    path: string;
};

export type GitDiffSummaryReport =
    | {
        reason: string;
        runtime: 'browser';
        status: 'unsupported';
    }
    | {
        reason: string;
        runtime: GitStatusRuntime;
        status: 'error';
    }
    | ({
        runtime: 'desktop';
        status: 'ready';
    } & GitDiffSummarySnapshot);

export type GitDiffSummarySnapshot = {
    files: GitDiffFileSummary[];
    isRepository: boolean;
    rawNumstat: string;
};

export type GitPushCurrentBranchOptions = {
    dryRun?: boolean;
    remoteName?: string;
};

export type GitPushCurrentBranchReport =
    | {
        reason: string;
        runtime: 'browser';
        status: 'unsupported';
    }
    | {
        reason: string;
        runtime: 'desktop';
        status: 'not-repository';
    }
    | {
        reason: string;
        runtime: GitStatusRuntime;
        status: 'error';
    }
    | ({
        runtime: 'desktop';
        status: 'pushed';
    } & GitPushCurrentBranchSnapshot);

export type GitPushCurrentBranchSnapshot = {
    branchName: string;
    dryRun: boolean;
    rawOutput: string;
    remoteName: string;
    repositoryRoot?: string;
};

export type GitRemoteEntry = {
    fetchUrl?: string;
    name: string;
    pushUrl?: string;
};

export type GitRemoteSummaryReport =
    | {
        reason: string;
        runtime: 'browser';
        status: 'unsupported';
    }
    | {
        reason: string;
        runtime: GitStatusRuntime;
        status: 'error';
    }
    | ({
        runtime: 'desktop';
        status: 'ready';
    } & GitRemoteSummarySnapshot);

export type GitRemoteSummarySnapshot = {
    isRepository: boolean;
    rawRemotes: string;
    remotes: GitRemoteEntry[];
    repositoryRoot?: string;
};

export type GitStageAllReport =
    | {
        reason: string;
        runtime: 'browser';
        status: 'unsupported';
    }
    | {
        reason: string;
        runtime: 'desktop';
        status: 'not-repository';
    }
    | {
        reason: string;
        runtime: GitStatusRuntime;
        status: 'error';
    }
    | ({
        runtime: 'desktop';
        status: 'staged';
    } & GitStageAllSnapshot);

export type GitStageAllSnapshot = {
    rawOutput: string;
    repositoryRoot?: string;
    stagedCount: number;
};

export type GitStatusEntry = {
    index: string;
    path: string;
    workingTree: string;
};

export type GitStatusReport =
    | {
        reason: string;
        runtime: 'browser';
        status: 'unsupported';
    }
    | {
        reason: string;
        runtime: GitStatusRuntime;
        status: 'error';
    }
    | ({
        runtime: 'desktop';
        status: 'ready';
    } & GitStatusSnapshot);

export type GitStatusRuntime = 'browser' | 'desktop';

export type GitStatusSnapshot = {
    ahead: number;
    behind: number;
    branch?: string;
    entries: GitStatusEntry[];
    isRepository: boolean;
    rawStatus: string;
    repositoryRoot?: string;
};

type GitStatusDependencies = {
    invoke?: TauriInvoke;
    isTauriRuntime?: () => boolean;
};

type NativeGitBranchEntry = {
    current?: unknown;
    name?: unknown;
    upstream?: unknown;
};

type NativeGitBranchSummaryResponse = {
    branches?: unknown;
    current?: unknown;
    isRepository?: unknown;
    rawBranches?: unknown;
    repositoryRoot?: unknown;
};

type NativeGitCheckoutBranchResponse = {
    branchName?: unknown;
    isRepository?: unknown;
    rawOutput?: unknown;
    repositoryRoot?: unknown;
};

type NativeGitCommitStagedResponse = {
    commitHash?: unknown;
    isRepository?: unknown;
    rawOutput?: unknown;
    repositoryRoot?: unknown;
};

type NativeGitCreateBranchResponse = {
    branchName?: unknown;
    isRepository?: unknown;
    rawOutput?: unknown;
    repositoryRoot?: unknown;
};

type NativeGitDiffFileSummary = {
    binary?: unknown;
    deletions?: unknown;
    insertions?: unknown;
    path?: unknown;
};

type NativeGitDiffSummaryResponse = {
    files?: unknown;
    isRepository?: unknown;
    rawNumstat?: unknown;
};

type NativeGitPushCurrentBranchResponse = {
    branchName?: unknown;
    dryRun?: unknown;
    isRepository?: unknown;
    rawOutput?: unknown;
    remoteName?: unknown;
    repositoryRoot?: unknown;
};

type NativeGitRemoteEntry = {
    fetchUrl?: unknown;
    name?: unknown;
    pushUrl?: unknown;
};

type NativeGitRemoteSummaryResponse = {
    isRepository?: unknown;
    rawRemotes?: unknown;
    remotes?: unknown;
    repositoryRoot?: unknown;
};

type NativeGitStageAllResponse = {
    isRepository?: unknown;
    rawOutput?: unknown;
    repositoryRoot?: unknown;
    stagedCount?: unknown;
};

type NativeGitStatusEntry = {
    index?: unknown;
    path?: unknown;
    workingTree?: unknown;
};

type NativeGitStatusResponse = {
    ahead?: unknown;
    behind?: unknown;
    branch?: unknown;
    entries?: unknown;
    isRepository?: unknown;
    rawStatus?: unknown;
    repositoryRoot?: unknown;
};

type TauriInvoke = <T>(command: string, arguments_?: Record<string, unknown>) => Promise<T>;

export async function createGitBranchReport(
    projectPath: string | undefined,
    branchName: string | undefined,
    dependencies: GitStatusDependencies = {},
): Promise<GitCreateBranchReport> {
    const runtime: GitStatusRuntime = (dependencies.isTauriRuntime ?? isTauriRuntime)() ? 'desktop' : 'browser';
    const trimmedProjectPath = projectPath?.trim();
    const trimmedBranchName = branchName?.trim();

    if (!trimmedProjectPath) {
        return {
            reason: 'No project is currently open.',
            runtime,
            status: 'error',
        };
    }

    if (!trimmedBranchName) {
        return {
            reason: 'Branch name is required.',
            runtime,
            status: 'error',
        };
    }

    if (runtime === 'browser') {
        return {
            reason: 'Git branch creation is disabled in browser builds until repository access and project-handle persistence are designed.',
            runtime,
            status: 'unsupported',
        };
    }

    try {
        const invoke = dependencies.invoke ?? await loadTauriInvoke();
        const response = await invoke<NativeGitCreateBranchResponse>('git_create_branch', {
            request: { branchName: trimmedBranchName, projectPath: trimmedProjectPath },
        });
        const normalized = normalizeGitCreateBranchResponse(response);

        if (!normalized.isRepository) {
            return {
                reason: `Git repository: none found for ${trimmedProjectPath}`,
                runtime,
                status: 'not-repository',
            };
        }

        if (!normalized.branchName) {
            return {
                reason: 'Git branch creation did not return a branch name.',
                runtime,
                status: 'error',
            };
        }

        return {
            branchName: normalized.branchName,
            rawOutput: normalized.rawOutput,
            repositoryRoot: normalized.repositoryRoot,
            runtime,
            status: 'created',
        };
    } catch (error) {
        return {
            reason: stringifyError(error),
            runtime,
            status: 'error',
        };
    }
}

export async function createGitBranchSummaryReport(
    projectPath: string | undefined,
    dependencies: GitStatusDependencies = {},
): Promise<GitBranchSummaryReport> {
    const runtime: GitStatusRuntime = (dependencies.isTauriRuntime ?? isTauriRuntime)() ? 'desktop' : 'browser';
    const trimmedProjectPath = projectPath?.trim();

    if (!trimmedProjectPath) {
        return {
            reason: 'No project is currently open.',
            runtime,
            status: 'error',
        };
    }

    if (runtime === 'browser') {
        return {
            reason: 'Git branch summary is disabled in browser builds until repository access and project-handle persistence are designed.',
            runtime,
            status: 'unsupported',
        };
    }

    try {
        const invoke = dependencies.invoke ?? await loadTauriInvoke();
        const response = await invoke<NativeGitBranchSummaryResponse>('git_branch_summary', {
            request: { projectPath: trimmedProjectPath },
        });

        return {
            ...normalizeGitBranchSummaryResponse(response),
            runtime,
            status: 'ready',
        };
    } catch (error) {
        return {
            reason: stringifyError(error),
            runtime,
            status: 'error',
        };
    }
}

export async function createGitCheckoutBranchReport(
    projectPath: string | undefined,
    branchName: string | undefined,
    dependencies: GitStatusDependencies = {},
): Promise<GitCheckoutBranchReport> {
    const runtime: GitStatusRuntime = (dependencies.isTauriRuntime ?? isTauriRuntime)() ? 'desktop' : 'browser';
    const trimmedProjectPath = projectPath?.trim();
    const trimmedBranchName = branchName?.trim();

    if (!trimmedProjectPath) {
        return {
            reason: 'No project is currently open.',
            runtime,
            status: 'error',
        };
    }

    if (!trimmedBranchName) {
        return {
            reason: 'Branch name is required.',
            runtime,
            status: 'error',
        };
    }

    if (runtime === 'browser') {
        return {
            reason: 'Git checkout is disabled in browser builds until repository access and project-handle persistence are designed.',
            runtime,
            status: 'unsupported',
        };
    }

    try {
        const invoke = dependencies.invoke ?? await loadTauriInvoke();
        const response = await invoke<NativeGitCheckoutBranchResponse>('git_checkout_branch', {
            request: { branchName: trimmedBranchName, projectPath: trimmedProjectPath },
        });
        const normalized = normalizeGitCheckoutBranchResponse(response);

        if (!normalized.isRepository) {
            return {
                reason: `Git repository: none found for ${trimmedProjectPath}`,
                runtime,
                status: 'not-repository',
            };
        }

        if (!normalized.branchName) {
            return {
                reason: 'Git checkout did not return a branch name.',
                runtime,
                status: 'error',
            };
        }

        return {
            branchName: normalized.branchName,
            rawOutput: normalized.rawOutput,
            repositoryRoot: normalized.repositoryRoot,
            runtime,
            status: 'checked-out',
        };
    } catch (error) {
        return {
            reason: stringifyError(error),
            runtime,
            status: 'error',
        };
    }
}

export async function createGitCommitStagedReport(
    projectPath: string | undefined,
    message: string | undefined,
    dependencies: GitStatusDependencies = {},
): Promise<GitCommitStagedReport> {
    const runtime: GitStatusRuntime = (dependencies.isTauriRuntime ?? isTauriRuntime)() ? 'desktop' : 'browser';
    const trimmedProjectPath = projectPath?.trim();
    const trimmedMessage = message?.trim();

    if (!trimmedProjectPath) {
        return {
            reason: 'No project is currently open.',
            runtime,
            status: 'error',
        };
    }

    if (!trimmedMessage) {
        return {
            reason: 'Commit message is required.',
            runtime,
            status: 'error',
        };
    }

    if (runtime === 'browser') {
        return {
            reason: 'Git commit is disabled in browser builds until repository access and project-handle persistence are designed.',
            runtime,
            status: 'unsupported',
        };
    }

    try {
        const invoke = dependencies.invoke ?? await loadTauriInvoke();
        const response = await invoke<NativeGitCommitStagedResponse>('git_commit_staged', {
            request: { message: trimmedMessage, projectPath: trimmedProjectPath },
        });
        const normalized = normalizeGitCommitStagedResponse(response);

        if (!normalized.isRepository) {
            return {
                reason: `Git repository: none found for ${trimmedProjectPath}`,
                runtime,
                status: 'not-repository',
            };
        }

        if (!normalized.commitHash) {
            return {
                reason: 'Git commit did not return a commit hash.',
                runtime,
                status: 'error',
            };
        }

        return {
            commitHash: normalized.commitHash,
            rawOutput: normalized.rawOutput,
            repositoryRoot: normalized.repositoryRoot,
            runtime,
            status: 'committed',
        };
    } catch (error) {
        return {
            reason: stringifyError(error),
            runtime,
            status: 'error',
        };
    }
}

export async function createGitDiffSummaryReport(
    projectPath: string | undefined,
    dependencies: GitStatusDependencies = {},
): Promise<GitDiffSummaryReport> {
    const runtime: GitStatusRuntime = (dependencies.isTauriRuntime ?? isTauriRuntime)() ? 'desktop' : 'browser';
    const trimmedProjectPath = projectPath?.trim();

    if (!trimmedProjectPath) {
        return {
            reason: 'No project is currently open.',
            runtime,
            status: 'error',
        };
    }

    if (runtime === 'browser') {
        return {
            reason: 'Git diff summary is disabled in browser builds until repository access and project-handle persistence are designed.',
            runtime,
            status: 'unsupported',
        };
    }

    try {
        const invoke = dependencies.invoke ?? await loadTauriInvoke();
        const response = await invoke<NativeGitDiffSummaryResponse>('git_diff_summary', {
            request: { projectPath: trimmedProjectPath },
        });

        return {
            ...normalizeGitDiffSummaryResponse(response),
            runtime,
            status: 'ready',
        };
    } catch (error) {
        return {
            reason: stringifyError(error),
            runtime,
            status: 'error',
        };
    }
}

export async function createGitPushCurrentBranchReport(
    projectPath: string | undefined,
    options: GitPushCurrentBranchOptions = {},
    dependencies: GitStatusDependencies = {},
): Promise<GitPushCurrentBranchReport> {
    const runtime: GitStatusRuntime = (dependencies.isTauriRuntime ?? isTauriRuntime)() ? 'desktop' : 'browser';
    const trimmedProjectPath = projectPath?.trim();
    const remoteName = options.remoteName?.trim();

    if (!trimmedProjectPath) {
        return {
            reason: 'No project is currently open.',
            runtime,
            status: 'error',
        };
    }

    if (!remoteName) {
        return {
            reason: 'Remote name is required.',
            runtime,
            status: 'error',
        };
    }

    if (runtime === 'browser') {
        return {
            reason: 'Git push is disabled in browser builds until repository access and credential policy are designed.',
            runtime,
            status: 'unsupported',
        };
    }

    try {
        const invoke = dependencies.invoke ?? await loadTauriInvoke();
        const response = await invoke<NativeGitPushCurrentBranchResponse>('git_push_current_branch', {
            request: {
                dryRun: options.dryRun === true,
                projectPath: trimmedProjectPath,
                remoteName,
            },
        });
        const normalized = normalizeGitPushCurrentBranchResponse(response);

        if (!normalized.isRepository) {
            return {
                reason: `Git repository: none found for ${trimmedProjectPath}`,
                runtime,
                status: 'not-repository',
            };
        }

        if (!normalized.branchName || !normalized.remoteName) {
            return {
                reason: 'Git push did not return branch and remote metadata.',
                runtime,
                status: 'error',
            };
        }

        return {
            branchName: normalized.branchName,
            dryRun: normalized.dryRun,
            rawOutput: normalized.rawOutput,
            remoteName: normalized.remoteName,
            repositoryRoot: normalized.repositoryRoot,
            runtime,
            status: 'pushed',
        };
    } catch (error) {
        return {
            reason: stringifyError(error),
            runtime,
            status: 'error',
        };
    }
}

export async function createGitRemoteSummaryReport(
    projectPath: string | undefined,
    dependencies: GitStatusDependencies = {},
): Promise<GitRemoteSummaryReport> {
    const runtime: GitStatusRuntime = (dependencies.isTauriRuntime ?? isTauriRuntime)() ? 'desktop' : 'browser';
    const trimmedProjectPath = projectPath?.trim();

    if (!trimmedProjectPath) {
        return {
            reason: 'No project is currently open.',
            runtime,
            status: 'error',
        };
    }

    if (runtime === 'browser') {
        return {
            reason: 'Git remote summary is disabled in browser builds until repository access and project-handle persistence are designed.',
            runtime,
            status: 'unsupported',
        };
    }

    try {
        const invoke = dependencies.invoke ?? await loadTauriInvoke();
        const response = await invoke<NativeGitRemoteSummaryResponse>('git_remote_summary', {
            request: { projectPath: trimmedProjectPath },
        });

        return {
            ...normalizeGitRemoteSummaryResponse(response),
            runtime,
            status: 'ready',
        };
    } catch (error) {
        return {
            reason: stringifyError(error),
            runtime,
            status: 'error',
        };
    }
}

export async function createGitStageAllReport(
    projectPath: string | undefined,
    dependencies: GitStatusDependencies = {},
): Promise<GitStageAllReport> {
    const runtime: GitStatusRuntime = (dependencies.isTauriRuntime ?? isTauriRuntime)() ? 'desktop' : 'browser';
    const trimmedProjectPath = projectPath?.trim();

    if (!trimmedProjectPath) {
        return {
            reason: 'No project is currently open.',
            runtime,
            status: 'error',
        };
    }

    if (runtime === 'browser') {
        return {
            reason: 'Git staging is disabled in browser builds until repository access and project-handle persistence are designed.',
            runtime,
            status: 'unsupported',
        };
    }

    try {
        const invoke = dependencies.invoke ?? await loadTauriInvoke();
        const response = await invoke<NativeGitStageAllResponse>('git_stage_all', {
            request: { projectPath: trimmedProjectPath },
        });
        const normalized = normalizeGitStageAllResponse(response);

        if (!normalized.isRepository) {
            return {
                reason: `Git repository: none found for ${trimmedProjectPath}`,
                runtime,
                status: 'not-repository',
            };
        }

        return {
            rawOutput: normalized.rawOutput,
            repositoryRoot: normalized.repositoryRoot,
            runtime,
            stagedCount: normalized.stagedCount,
            status: 'staged',
        };
    } catch (error) {
        return {
            reason: stringifyError(error),
            runtime,
            status: 'error',
        };
    }
}

export async function createGitStatusReport(
    projectPath: string | undefined,
    dependencies: GitStatusDependencies = {},
): Promise<GitStatusReport> {
    const runtime: GitStatusRuntime = (dependencies.isTauriRuntime ?? isTauriRuntime)() ? 'desktop' : 'browser';
    const trimmedProjectPath = projectPath?.trim();

    if (!trimmedProjectPath) {
        return {
            reason: 'No project is currently open.',
            runtime,
            status: 'error',
        };
    }

    if (runtime === 'browser') {
        return {
            reason: 'Git status is disabled in browser builds until repository access and project-handle persistence are designed.',
            runtime,
            status: 'unsupported',
        };
    }

    try {
        const invoke = dependencies.invoke ?? await loadTauriInvoke();
        const response = await invoke<NativeGitStatusResponse>('git_status', {
            request: { projectPath: trimmedProjectPath },
        });

        return {
            ...normalizeGitStatusResponse(response),
            runtime,
            status: 'ready',
        };
    } catch (error) {
        return {
            reason: stringifyError(error),
            runtime,
            status: 'error',
        };
    }
}

async function loadTauriInvoke(): Promise<TauriInvoke> {
    const { invoke } = await import('@tauri-apps/api/core');
    return <T>(command: string, arguments_?: Record<string, unknown>) => invoke<T>(command, arguments_);
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

function normalizeGitBranchSummaryResponse(response: NativeGitBranchSummaryResponse): GitBranchSummarySnapshot {
    const branches = normalizeBranchEntries(response.branches);
    return {
        branches,
        current: normalizeOptionalString(response.current) ?? branches.find((branch) => branch.current)?.name,
        isRepository: response.isRepository === true,
        rawBranches: typeof response.rawBranches === 'string' ? response.rawBranches : '',
        repositoryRoot: normalizeOptionalString(response.repositoryRoot),
    };
}

function normalizeGitCheckoutBranchResponse(response: NativeGitCheckoutBranchResponse): {
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

function normalizeGitCommitStagedResponse(response: NativeGitCommitStagedResponse): {
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

function normalizeGitCreateBranchResponse(response: NativeGitCreateBranchResponse): {
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

function normalizeGitDiffSummaryResponse(response: NativeGitDiffSummaryResponse): GitDiffSummarySnapshot {
    return {
        files: normalizeDiffFiles(response.files),
        isRepository: response.isRepository === true,
        rawNumstat: typeof response.rawNumstat === 'string' ? response.rawNumstat : '',
    };
}

function normalizeGitPushCurrentBranchResponse(response: NativeGitPushCurrentBranchResponse): {
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

function normalizeGitRemoteSummaryResponse(response: NativeGitRemoteSummaryResponse): GitRemoteSummarySnapshot {
    return {
        isRepository: response.isRepository === true,
        rawRemotes: typeof response.rawRemotes === 'string' ? response.rawRemotes : '',
        remotes: normalizeGitRemoteEntries(response.remotes),
        repositoryRoot: normalizeOptionalString(response.repositoryRoot),
    };
}

function normalizeGitStageAllResponse(response: NativeGitStageAllResponse): {
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

function normalizeGitStatusResponse(response: NativeGitStatusResponse): GitStatusSnapshot {
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

function normalizeOptionalString(value: unknown): string | undefined {
    if (typeof value !== 'string') return undefined;

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeStatusCode(value: unknown): string {
    if (typeof value !== 'string' || value.length === 0) return ' ';
    return value.slice(0, 1);
}

function stringifyError(error: unknown): string {
    if (error instanceof Error) return error.message;
    if (typeof error === 'string') return error;
    return 'Git status failed.';
}
