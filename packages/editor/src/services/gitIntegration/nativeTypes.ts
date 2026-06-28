export type NativeGitBranchEntry = {
    current?: unknown;
    name?: unknown;
    upstream?: unknown;
};

export type NativeGitBranchSummaryResponse = {
    branches?: unknown;
    current?: unknown;
    isRepository?: unknown;
    rawBranches?: unknown;
    repositoryRoot?: unknown;
};

export type NativeGitCheckoutBranchResponse = {
    branchName?: unknown;
    isRepository?: unknown;
    rawOutput?: unknown;
    repositoryRoot?: unknown;
};

export type NativeGitCommitStagedResponse = {
    commitHash?: unknown;
    isRepository?: unknown;
    rawOutput?: unknown;
    repositoryRoot?: unknown;
};

export type NativeGitCreateBranchResponse = {
    branchName?: unknown;
    isRepository?: unknown;
    rawOutput?: unknown;
    repositoryRoot?: unknown;
};

export type NativeGitDiffFileResponse = {
    isRepository?: unknown;
    path?: unknown;
    rawDiff?: unknown;
    repositoryRoot?: unknown;
};

export type NativeGitDiffFileSummary = {
    binary?: unknown;
    deletions?: unknown;
    insertions?: unknown;
    path?: unknown;
};

export type NativeGitDiffSummaryResponse = {
    files?: unknown;
    isRepository?: unknown;
    rawNumstat?: unknown;
};

export type NativeGitFileActionResponse = {
    isRepository?: unknown;
    path?: unknown;
    rawOutput?: unknown;
    repositoryRoot?: unknown;
    stagedCount?: unknown;
};

export type NativeGitInitRepositoryResponse = {
    initialized?: unknown;
    isRepository?: unknown;
    rawOutput?: unknown;
    repositoryRoot?: unknown;
};

export type NativeGitPushCurrentBranchResponse = {
    branchName?: unknown;
    dryRun?: unknown;
    isRepository?: unknown;
    rawOutput?: unknown;
    remoteName?: unknown;
    repositoryRoot?: unknown;
};

export type NativeGitRemoteEntry = {
    fetchUrl?: unknown;
    name?: unknown;
    pushUrl?: unknown;
};

export type NativeGitRemoteSummaryResponse = {
    isRepository?: unknown;
    rawRemotes?: unknown;
    remotes?: unknown;
    repositoryRoot?: unknown;
};

export type NativeGitStageAllResponse = {
    isRepository?: unknown;
    rawOutput?: unknown;
    repositoryRoot?: unknown;
    stagedCount?: unknown;
};

export type NativeGitStatusEntry = {
    index?: unknown;
    path?: unknown;
    workingTree?: unknown;
};

export type NativeGitStatusResponse = {
    ahead?: unknown;
    behind?: unknown;
    branch?: unknown;
    entries?: unknown;
    isRepository?: unknown;
    rawStatus?: unknown;
    repositoryRoot?: unknown;
};
