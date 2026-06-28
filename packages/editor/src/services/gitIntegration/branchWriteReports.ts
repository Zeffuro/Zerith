import type { NativeGitCheckoutBranchResponse, NativeGitCreateBranchResponse } from './nativeTypes';
import type {
    GitCheckoutBranchReport,
    GitCreateBranchReport,
    GitStatusDependencies,
} from './types';

import { normalizeGitCheckoutBranchResponse, normalizeGitCreateBranchResponse } from './normalizers';
import { loadTauriInvoke, resolveGitRuntime, stringifyError } from './runtime';

export async function createGitBranchReport(
    projectPath: string | undefined,
    branchName: string | undefined,
    dependencies: GitStatusDependencies = {},
): Promise<GitCreateBranchReport> {
    const runtime = resolveGitRuntime(dependencies);
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

export async function createGitCheckoutBranchReport(
    projectPath: string | undefined,
    branchName: string | undefined,
    dependencies: GitStatusDependencies = {},
): Promise<GitCheckoutBranchReport> {
    const runtime = resolveGitRuntime(dependencies);
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
