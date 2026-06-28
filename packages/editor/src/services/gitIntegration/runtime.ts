import type { GitCommitStagedOptions, GitStatusDependencies, GitStatusRuntime, TauriInvoke } from './types';

import { isTauriRuntime } from '../runtime/runtimeEnvironment';

export async function loadTauriInvoke(): Promise<TauriInvoke> {
    const { invoke } = await import('@tauri-apps/api/core');
    return <T>(command: string, arguments_?: Record<string, unknown>) => invoke<T>(command, arguments_);
}

export function resolveGitCommitArguments(
    optionsOrDependencies: GitCommitStagedOptions | GitStatusDependencies,
    dependencies: GitStatusDependencies | undefined,
): {
    dependencies: GitStatusDependencies;
    options: GitCommitStagedOptions;
} {
    if (isGitStatusDependencies(optionsOrDependencies)) {
        return {
            dependencies: optionsOrDependencies,
            options: {},
        };
    }

    return {
        dependencies: dependencies ?? {},
        options: optionsOrDependencies,
    };
}

export function resolveGitRuntime(dependencies: GitStatusDependencies): GitStatusRuntime {
    return (dependencies.isTauriRuntime ?? isTauriRuntime)() ? 'desktop' : 'browser';
}

export function stringifyError(error: unknown): string {
    if (error instanceof Error) return error.message;
    if (typeof error === 'string') return error;
    return 'Git status failed.';
}

function isGitStatusDependencies(value: GitCommitStagedOptions | GitStatusDependencies): value is GitStatusDependencies {
    return 'invoke' in value || 'isTauriRuntime' in value;
}
