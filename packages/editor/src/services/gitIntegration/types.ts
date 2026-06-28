export type GitStatusRuntime = 'browser' | 'desktop';

export type TauriInvoke = <T>(command: string, arguments_?: Record<string, unknown>) => Promise<T>;

export type GitStatusDependencies = {
    invoke?: TauriInvoke;
    isTauriRuntime?: () => boolean;
};

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

export type GitCommitStagedOptions = {
    description?: string;
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

export type GitDiffFileReport =
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
    } & GitDiffFileSnapshot);

export type GitDiffFileSnapshot = {
    isRepository: boolean;
    path: string;
    rawDiff: string;
    repositoryRoot?: string;
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

export type GitFileActionSnapshot = {
    path: string;
    rawOutput: string;
    repositoryRoot?: string;
    stagedCount: number;
};

export type GitInitRepositoryReport =
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
        status: 'initialized';
    } & GitInitRepositorySnapshot);

export type GitInitRepositorySnapshot = {
    initialized: boolean;
    isRepository: boolean;
    rawOutput: string;
    repositoryRoot?: string;
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

export type GitStageFileReport =
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
    } & GitFileActionSnapshot);

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

export type GitStatusSnapshot = {
    ahead: number;
    behind: number;
    branch?: string;
    entries: GitStatusEntry[];
    isRepository: boolean;
    rawStatus: string;
    repositoryRoot?: string;
};

export type GitUnstageFileReport =
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
        status: 'unstaged';
    } & GitFileActionSnapshot);
