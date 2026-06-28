import type {
    NativeGitCommitStagedResponse,
    NativeGitInitRepositoryResponse,
    NativeGitPushCurrentBranchResponse,
} from './nativeTypes';
import type {
    GitCommitStagedOptions,
    GitCommitStagedReport,
    GitInitRepositoryReport,
    GitPushCurrentBranchOptions,
    GitPushCurrentBranchReport,
    GitStatusDependencies,
} from './types';

import {
    normalizeGitCommitStagedResponse,
    normalizeGitInitRepositoryResponse,
    normalizeGitPushCurrentBranchResponse,
} from './normalizers';
import { loadTauriInvoke, resolveGitCommitArguments, resolveGitRuntime, stringifyError } from './runtime';

export async function createGitCommitStagedReport(
    projectPath: string | undefined,
    message: string | undefined,
    optionsOrDependencies: GitCommitStagedOptions | GitStatusDependencies = {},
    dependencies?: GitStatusDependencies,
): Promise<GitCommitStagedReport> {
    const resolved = resolveGitCommitArguments(optionsOrDependencies, dependencies);
    const runtime = resolveGitRuntime(resolved.dependencies);
    const trimmedProjectPath = projectPath?.trim();
    const trimmedMessage = message?.trim();
    const trimmedDescription = resolved.options.description?.trim();

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
        const invoke = resolved.dependencies.invoke ?? await loadTauriInvoke();
        const request = trimmedDescription
            ? { description: trimmedDescription, message: trimmedMessage, projectPath: trimmedProjectPath }
            : { message: trimmedMessage, projectPath: trimmedProjectPath };
        const response = await invoke<NativeGitCommitStagedResponse>('git_commit_staged', {
            request,
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

export async function createGitInitRepositoryReport(
    projectPath: string | undefined,
    dependencies: GitStatusDependencies = {},
): Promise<GitInitRepositoryReport> {
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
            reason: 'Git repository initialization is disabled in browser builds until repository access and project-handle persistence are designed.',
            runtime,
            status: 'unsupported',
        };
    }

    try {
        const invoke = dependencies.invoke ?? await loadTauriInvoke();
        const response = await invoke<NativeGitInitRepositoryResponse>('git_init_repository', {
            request: { projectPath: trimmedProjectPath },
        });
        const normalized = normalizeGitInitRepositoryResponse(response);

        if (!normalized.isRepository) {
            return {
                reason: `Git repository initialization did not return a repository for ${trimmedProjectPath}`,
                runtime,
                status: 'error',
            };
        }

        return {
            ...normalized,
            runtime,
            status: 'initialized',
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
    const runtime = resolveGitRuntime(dependencies);
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
