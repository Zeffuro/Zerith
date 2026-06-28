import {
    normalizeGitBranchSummaryResponse,
    normalizeGitDiffFileResponse,
    normalizeGitDiffSummaryResponse,
    normalizeGitRemoteSummaryResponse,
    normalizeGitStatusResponse,
} from './normalizers';
import { loadTauriInvoke, resolveGitRuntime, stringifyError } from './runtime';

import type {
    NativeGitBranchSummaryResponse,
    NativeGitDiffFileResponse,
    NativeGitDiffSummaryResponse,
    NativeGitRemoteSummaryResponse,
    NativeGitStatusResponse,
} from './nativeTypes';
import type {
    GitBranchSummaryReport,
    GitDiffFileReport,
    GitDiffSummaryReport,
    GitRemoteSummaryReport,
    GitStatusDependencies,
    GitStatusReport,
} from './types';

export async function createGitBranchSummaryReport(
    projectPath: string | undefined,
    dependencies: GitStatusDependencies = {},
): Promise<GitBranchSummaryReport> {
    const runtime = resolveGitRuntime(dependencies);
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

export async function createGitDiffFileReport(
    projectPath: string | undefined,
    path: string | undefined,
    dependencies: GitStatusDependencies = {},
): Promise<GitDiffFileReport> {
    const runtime = resolveGitRuntime(dependencies);
    const trimmedProjectPath = projectPath?.trim();
    const trimmedPath = path?.trim();

    if (!trimmedProjectPath) {
        return {
            reason: 'No project is currently open.',
            runtime,
            status: 'error',
        };
    }

    if (!trimmedPath) {
        return {
            reason: 'Git file path is required.',
            runtime,
            status: 'error',
        };
    }

    if (runtime === 'browser') {
        return {
            reason: 'Git file diffs are disabled in browser builds until repository access and project-handle persistence are designed.',
            runtime,
            status: 'unsupported',
        };
    }

    try {
        const invoke = dependencies.invoke ?? await loadTauriInvoke();
        const response = await invoke<NativeGitDiffFileResponse>('git_diff_file', {
            request: { path: trimmedPath, projectPath: trimmedProjectPath },
        });
        const normalized = normalizeGitDiffFileResponse(response);

        return {
            ...normalized,
            path: normalized.path || trimmedPath,
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

export async function createGitDiffSummaryReport(
    projectPath: string | undefined,
    dependencies: GitStatusDependencies = {},
): Promise<GitDiffSummaryReport> {
    const runtime = resolveGitRuntime(dependencies);
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

export async function createGitRemoteSummaryReport(
    projectPath: string | undefined,
    dependencies: GitStatusDependencies = {},
): Promise<GitRemoteSummaryReport> {
    const runtime = resolveGitRuntime(dependencies);
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

export async function createGitStatusReport(
    projectPath: string | undefined,
    dependencies: GitStatusDependencies = {},
): Promise<GitStatusReport> {
    const runtime = resolveGitRuntime(dependencies);
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
