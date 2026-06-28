import { normalizeGitFileActionResponse, normalizeGitStageAllResponse } from './normalizers';
import { loadTauriInvoke, resolveGitRuntime, stringifyError } from './runtime';

import type { NativeGitFileActionResponse, NativeGitStageAllResponse } from './nativeTypes';
import type {
    GitStageAllReport,
    GitStageFileReport,
    GitStatusDependencies,
    GitUnstageFileReport,
} from './types';

export async function createGitStageAllReport(
    projectPath: string | undefined,
    dependencies: GitStatusDependencies = {},
): Promise<GitStageAllReport> {
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

export async function createGitStageFileReport(
    projectPath: string | undefined,
    path: string | undefined,
    dependencies: GitStatusDependencies = {},
): Promise<GitStageFileReport> {
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
            reason: 'Git file staging is disabled in browser builds until repository access and project-handle persistence are designed.',
            runtime,
            status: 'unsupported',
        };
    }

    try {
        const invoke = dependencies.invoke ?? await loadTauriInvoke();
        const response = await invoke<NativeGitFileActionResponse>('git_stage_file', {
            request: { path: trimmedPath, projectPath: trimmedProjectPath },
        });
        const normalized = normalizeGitFileActionResponse(response);

        if (!normalized.isRepository) {
            return {
                reason: `Git repository: none found for ${trimmedProjectPath}`,
                runtime,
                status: 'not-repository',
            };
        }

        return {
            path: normalized.path || trimmedPath,
            rawOutput: normalized.rawOutput,
            ...(normalized.repositoryRoot === undefined ? {} : { repositoryRoot: normalized.repositoryRoot }),
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

export async function createGitUnstageFileReport(
    projectPath: string | undefined,
    path: string | undefined,
    dependencies: GitStatusDependencies = {},
): Promise<GitUnstageFileReport> {
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
            reason: 'Git file unstaging is disabled in browser builds until repository access and project-handle persistence are designed.',
            runtime,
            status: 'unsupported',
        };
    }

    try {
        const invoke = dependencies.invoke ?? await loadTauriInvoke();
        const response = await invoke<NativeGitFileActionResponse>('git_unstage_file', {
            request: { path: trimmedPath, projectPath: trimmedProjectPath },
        });
        const normalized = normalizeGitFileActionResponse(response);

        if (!normalized.isRepository) {
            return {
                reason: `Git repository: none found for ${trimmedProjectPath}`,
                runtime,
                status: 'not-repository',
            };
        }

        return {
            path: normalized.path || trimmedPath,
            rawOutput: normalized.rawOutput,
            ...(normalized.repositoryRoot === undefined ? {} : { repositoryRoot: normalized.repositoryRoot }),
            runtime,
            stagedCount: normalized.stagedCount,
            status: 'unstaged',
        };
    } catch (error) {
        return {
            reason: stringifyError(error),
            runtime,
            status: 'error',
        };
    }
}
