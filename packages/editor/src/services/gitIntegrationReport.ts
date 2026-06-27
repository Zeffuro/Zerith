import type { GitRemoteEntry } from './gitIntegration';

export type GitIntegrationReport = {
    recommendedNextStep: string;
    runtime: GitIntegrationRuntime;
    strategies: GitIntegrationStrategy[];
    summary: Record<GitIntegrationStrategyStatus, number>;
};

export type GitIntegrationReportOptions = {
    runtime: GitIntegrationRuntime;
};

export type GitIntegrationRuntime = 'browser' | 'desktop';

export type GitIntegrationStrategy = {
    browser: GitIntegrationStrategyStatus;
    desktop: GitIntegrationStrategyStatus;
    id: GitIntegrationStrategyId;
    note: string;
};

export type GitIntegrationStrategyId =
    | 'browserWebGit'
    | 'externalGitCli'
    | 'tauriRustBackend';

export type GitIntegrationStrategyStatus =
    | 'deferred'
    | 'limited'
    | 'recommended'
    | 'unsupported';

export type GitRemoteCredentialMode =
    | 'external-helper'
    | 'missing'
    | 'none'
    | 'ssh-agent'
    | 'unknown';

export type GitRemotePolicyEntry = {
    credentialMode: GitRemoteCredentialMode;
    effectivePushUrl?: string;
    fetchUrl?: string;
    name: string;
    note: string;
    pushUrl?: string;
    status: GitRemotePolicyStatus;
    transport: GitRemoteTransport;
};

export type GitRemotePolicyReport = {
    entries: GitRemotePolicyEntry[];
    recommendedRemote?: string;
    summary: Record<GitRemotePolicyStatus, number>;
};

export type GitRemotePolicyStatus =
    | 'blocked'
    | 'ready'
    | 'review';

export type GitRemoteTransport =
    | 'file'
    | 'https'
    | 'missing'
    | 'other'
    | 'ssh';

const GIT_STRATEGIES: readonly GitIntegrationStrategy[] = [
    {
        browser: 'unsupported',
        desktop: 'recommended',
        id: 'tauriRustBackend',
        note: 'Use a Tauri/Rust backend first so desktop projects can run repository status, diff, commit, and branch operations against real project paths.',
    },
    {
        browser: 'unsupported',
        desktop: 'limited',
        id: 'externalGitCli',
        note: 'Shelling out to a local git executable is viable for prototypes but adds PATH/toolchain variance and weaker error shaping than a Rust backend.',
    },
    {
        browser: 'deferred',
        desktop: 'unsupported',
        id: 'browserWebGit',
        note: 'Browser builds should defer or omit git until the editor has a clear web storage/project-handle policy; web-git cannot transparently operate on arbitrary local repositories.',
    },
];

export function createGitIntegrationReport(options: GitIntegrationReportOptions): GitIntegrationReport {
    const runtimeStatuses = GIT_STRATEGIES.map((strategy) => strategy[options.runtime]);

    return {
        recommendedNextStep: options.runtime === 'desktop'
            ? 'Prototype a Tauri/Rust git status/diff backend before adding browser git behavior.'
            : 'Keep git disabled or read-only in browser builds until project-handle persistence and repository access are explicitly designed.',
        runtime: options.runtime,
        strategies: GIT_STRATEGIES.map((strategy) => ({ ...strategy })),
        summary: {
            deferred: runtimeStatuses.filter((status) => status === 'deferred').length,
            limited: runtimeStatuses.filter((status) => status === 'limited').length,
            recommended: runtimeStatuses.filter((status) => status === 'recommended').length,
            unsupported: runtimeStatuses.filter((status) => status === 'unsupported').length,
        },
    };
}

export function createGitRemotePolicyReport(remotes: readonly GitRemoteEntry[]): GitRemotePolicyReport {
    const entries = remotes
        .map((remote) => createGitRemotePolicyEntry(remote))
        .toSorted((left, right) => left.name.localeCompare(right.name));
    const recommendedRemote = entries.find((entry) => entry.status === 'ready')?.name
        ?? entries.find((entry) => entry.status === 'review')?.name;

    return {
        entries,
        ...(recommendedRemote === undefined ? {} : { recommendedRemote }),
        summary: {
            blocked: entries.filter((entry) => entry.status === 'blocked').length,
            ready: entries.filter((entry) => entry.status === 'ready').length,
            review: entries.filter((entry) => entry.status === 'review').length,
        },
    };
}

function classifyGitRemoteTransport(url: string | undefined): GitRemoteTransport {
    if (!url) return 'missing';
    if (/^https?:\/\//iu.test(url)) return 'https';
    if (/^(?:ssh:\/\/|[^@\s]+@[^:\s]+:.+)/iu.test(url)) return 'ssh';
    if (/^(?:file:\/\/|[a-z]:[\\/]|\.{0,2}[\\/]|\/)/iu.test(url)) return 'file';
    return 'other';
}

function createGitRemotePolicyEntry(remote: GitRemoteEntry): GitRemotePolicyEntry {
    const effectivePushUrl = remote.pushUrl ?? remote.fetchUrl;
    const transport = classifyGitRemoteTransport(effectivePushUrl);
    const policy = describeRemotePolicy(transport);

    return {
        credentialMode: policy.credentialMode,
        ...(effectivePushUrl === undefined ? {} : { effectivePushUrl }),
        ...(remote.fetchUrl === undefined ? {} : { fetchUrl: remote.fetchUrl }),
        name: remote.name,
        note: policy.note,
        ...(remote.pushUrl === undefined ? {} : { pushUrl: remote.pushUrl }),
        status: policy.status,
        transport,
    };
}

function describeRemotePolicy(
    transport: GitRemoteTransport,
): Pick<GitRemotePolicyEntry, 'credentialMode' | 'note' | 'status'> {
    switch (transport) {
        case 'file': {
            return {
                credentialMode: 'none',
                note: 'Local/file remotes do not need credential prompts but should be reviewed before publishing workflows.',
                status: 'review',
            };
        }
        case 'https': {
            return {
                credentialMode: 'external-helper',
                note: 'HTTPS remotes rely on the system Git credential helper or token prompt outside the editor.',
                status: 'review',
            };
        }
        case 'missing': {
            return {
                credentialMode: 'missing',
                note: 'No fetch or push URL is configured for this remote.',
                status: 'blocked',
            };
        }
        case 'other': {
            return {
                credentialMode: 'unknown',
                note: 'Remote transport is not recognized; review credentials before enabling automated pushes.',
                status: 'review',
            };
        }
        case 'ssh': {
            return {
                credentialMode: 'ssh-agent',
                note: 'SSH remotes are compatible when the user has a working SSH agent or key configuration.',
                status: 'ready',
            };
        }
    }
}
