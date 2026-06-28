import { useCallback } from 'react';

import { refreshProjectTree } from '../../services/explorerFileActions';
import {
    createGitBranchReport,
    createGitBranchSummaryReport,
    createGitCheckoutBranchReport,
    createGitCommitStagedReport,
    createGitDiffSummaryReport,
    createGitPushCurrentBranchReport,
    createGitRemoteSummaryReport,
    createGitStageAllReport,
    createGitStatusReport,
} from '../../services/gitIntegration';
import { createGitIntegrationReport, createGitRemotePolicyReport } from '../../services/gitIntegrationReport';
import { isTauriRuntime } from '../../services/runtime/runtimeEnvironment';
import { executeConsoleMessageAction } from '../../store/actions/consoleMessageActions';
import { useProjectStore } from '../../store/storeBootstrap';

export function useCommandPaletteGitActions(projectPath: string | undefined) {
    const handleShowGitIntegrationReport = useCallback(() => {
        const runtime = isTauriRuntime() ? 'desktop' : 'browser';
        const report = createGitIntegrationReport({ runtime });
        const lines = [
            `Editor runtime: ${runtime}`,
            `Recommended: ${report.summary.recommended}, limited: ${report.summary.limited}, deferred: ${report.summary.deferred}, unsupported: ${report.summary.unsupported}`,
            `Backend: ${report.backendStrategy.engines.find((engine) => engine.id === report.backendStrategy.selectedEngineId)?.label ?? report.backendStrategy.selectedEngineId}`,
            `Next: ${report.recommendedNextStep}`,
            ...report.backendStrategy.engines.map((engine) => (
                `backend/${engine.id}: ${engine.status} - ${engine.note}`
            )),
            ...report.strategies.map((strategy) => (
                `${strategy.id}: desktop=${strategy.desktop}, browser=${strategy.browser} - ${strategy.note}`
            )),
        ];

        executeConsoleMessageAction('editor', 'info', lines.join('\n'));
    }, []);

    const handleGitCreateBranch = useCallback(async () => {
        if (!projectPath) return;

        const promptForBranchName = globalThis.prompt;
        if (typeof promptForBranchName !== 'function') {
            executeConsoleMessageAction('editor', 'warn', 'Git branch creation requires prompt support.');
            return;
        }

        const branchName = promptForBranchName('Create branch from current HEAD', 'feature/new-branch')?.trim();
        if (!branchName) return;

        const report = await createGitBranchReport(projectPath, branchName);
        if (report.status === 'unsupported') {
            executeConsoleMessageAction('editor', 'warn', report.reason);
            return;
        }

        if (report.status === 'not-repository') {
            executeConsoleMessageAction('editor', 'info', report.reason);
            return;
        }

        if (report.status === 'error') {
            executeConsoleMessageAction('editor', 'error', 'Git branch creation failed:', report.reason);
            return;
        }

        executeConsoleMessageAction(
            'editor',
            'info',
            `Created branch '${report.branchName}' at current HEAD. Current checkout was not changed.`,
        );
    }, [projectPath]);

    const handleGitCheckoutBranch = useCallback(async () => {
        if (!projectPath) return;

        const promptForBranchName = globalThis.prompt;
        if (typeof promptForBranchName !== 'function') {
            executeConsoleMessageAction('editor', 'warn', 'Git checkout requires prompt support.');
            return;
        }

        const branchName = promptForBranchName('Checkout existing branch', 'main')?.trim();
        if (!branchName) return;

        const report = await createGitCheckoutBranchReport(projectPath, branchName);
        if (report.status === 'unsupported') {
            executeConsoleMessageAction('editor', 'warn', report.reason);
            return;
        }

        if (report.status === 'not-repository') {
            executeConsoleMessageAction('editor', 'info', report.reason);
            return;
        }

        if (report.status === 'error') {
            executeConsoleMessageAction('editor', 'error', 'Git checkout failed:', report.reason);
            return;
        }

        await refreshProjectTree();
        await useProjectStore.getState().loadManifest();
        executeConsoleMessageAction('editor', 'info', `Checked out branch '${report.branchName}'.`);
    }, [projectPath]);

    const handleGitCommitStaged = useCallback(async () => {
        if (!projectPath) return;

        const promptForMessage = globalThis.prompt;
        if (typeof promptForMessage !== 'function') {
            executeConsoleMessageAction('editor', 'warn', 'Git commit requires prompt support.');
            return;
        }

        const message = promptForMessage('Commit staged changes', '')?.trim();
        if (!message) return;

        const report = await createGitCommitStagedReport(projectPath, message);
        if (report.status === 'unsupported') {
            executeConsoleMessageAction('editor', 'warn', report.reason);
            return;
        }

        if (report.status === 'not-repository') {
            executeConsoleMessageAction('editor', 'info', report.reason);
            return;
        }

        if (report.status === 'error') {
            executeConsoleMessageAction('editor', 'error', 'Git commit failed:', report.reason);
            return;
        }

        executeConsoleMessageAction('editor', 'info', `Created commit ${report.commitHash}.`);
    }, [projectPath]);

    const handleGitStageAll = useCallback(async () => {
        if (!projectPath) return;

        const confirmStageAll = globalThis.confirm;
        if (
            typeof confirmStageAll === 'function'
            && !confirmStageAll('Stage all Git changes under the open project folder?')
        ) {
            return;
        }

        const report = await createGitStageAllReport(projectPath);
        if (report.status === 'unsupported') {
            executeConsoleMessageAction('editor', 'warn', report.reason);
            return;
        }

        if (report.status === 'not-repository') {
            executeConsoleMessageAction('editor', 'info', report.reason);
            return;
        }

        if (report.status === 'error') {
            executeConsoleMessageAction('editor', 'error', 'Git staging failed:', report.reason);
            return;
        }

        if (report.stagedCount === 0) {
            executeConsoleMessageAction('editor', 'info', 'No project Git changes to stage.');
            return;
        }

        executeConsoleMessageAction(
            'editor',
            'info',
            `Staged ${report.stagedCount} project file${report.stagedCount === 1 ? '' : 's'}.`,
        );
    }, [projectPath]);

    const handleGitPushPreflight = useCallback(async () => {
        if (!projectPath) return;

        const promptForRemote = globalThis.prompt;
        if (typeof promptForRemote !== 'function') {
            executeConsoleMessageAction('editor', 'warn', 'Git push check requires prompt support.');
            return;
        }

        const remoteSummary = await createGitRemoteSummaryReport(projectPath);
        const defaultRemote = remoteSummary.status === 'ready' && remoteSummary.isRepository
            ? createGitRemotePolicyReport(remoteSummary.remotes).recommendedRemote
                ?? remoteSummary.remotes.find((remote) => remote.name === 'origin')?.name
                ?? remoteSummary.remotes[0]?.name
                ?? 'origin'
            : 'origin';
        const remoteName = promptForRemote('Check push remote with dry-run', defaultRemote)?.trim();
        if (!remoteName) return;

        const report = await createGitPushCurrentBranchReport(projectPath, {
            dryRun: true,
            remoteName,
        });
        if (report.status === 'unsupported') {
            executeConsoleMessageAction('editor', 'warn', report.reason);
            return;
        }

        if (report.status === 'not-repository') {
            executeConsoleMessageAction('editor', 'info', report.reason);
            return;
        }

        if (report.status === 'error') {
            executeConsoleMessageAction('editor', 'error', 'Git push check failed:', report.reason);
            return;
        }

        executeConsoleMessageAction(
            'editor',
            'info',
            `Push dry-run succeeded for '${report.branchName}' to '${report.remoteName}'. No commits were uploaded.`,
        );
    }, [projectPath]);

    const handleGitPushCurrentBranch = useCallback(async () => {
        if (!projectPath) return;

        const promptForRemote = globalThis.prompt;
        if (typeof promptForRemote !== 'function') {
            executeConsoleMessageAction('editor', 'warn', 'Git push requires prompt support.');
            return;
        }

        const remoteName = promptForRemote('Push current branch to remote', 'origin')?.trim();
        if (!remoteName) return;

        const confirmPush = globalThis.confirm;
        if (typeof confirmPush === 'function' && !confirmPush(`Push the current branch to '${remoteName}'?`)) {
            return;
        }

        const report = await createGitPushCurrentBranchReport(projectPath, { remoteName });
        if (report.status === 'unsupported') {
            executeConsoleMessageAction('editor', 'warn', report.reason);
            return;
        }

        if (report.status === 'not-repository') {
            executeConsoleMessageAction('editor', 'info', report.reason);
            return;
        }

        if (report.status === 'error') {
            executeConsoleMessageAction('editor', 'error', 'Git push failed:', report.reason);
            return;
        }

        executeConsoleMessageAction(
            'editor',
            'info',
            `Pushed branch '${report.branchName}' to '${report.remoteName}'.`,
        );
    }, [projectPath]);

    const handleShowGitStatusReport = useCallback(async () => {
        if (!projectPath) return;

        const report = await createGitStatusReport(projectPath);
        if (report.status === 'unsupported') {
            executeConsoleMessageAction('editor', 'warn', report.reason);
            return;
        }

        if (report.status === 'error') {
            executeConsoleMessageAction('editor', 'error', 'Git status failed:', report.reason);
            return;
        }

        if (!report.isRepository) {
            executeConsoleMessageAction('editor', 'info', `Git repository: none found for ${projectPath}`);
            return;
        }

        const entryLimit = 20;
        const lines = [
            `Git branch: ${report.branch ?? 'detached'} (ahead ${report.ahead}, behind ${report.behind})`,
            `Repository root: ${report.repositoryRoot ?? projectPath}`,
            `Changed files: ${report.entries.length}`,
            ...report.entries.slice(0, entryLimit).map((entry) => `${entry.index}${entry.workingTree} ${entry.path}`),
        ];

        if (report.entries.length > entryLimit) {
            lines.push(`... ${report.entries.length - entryLimit} more changed files`);
        }

        const diffReport = await createGitDiffSummaryReport(projectPath);
        if (diffReport.status === 'ready' && diffReport.isRepository) {
            const insertions = diffReport.files.reduce((total, file) => total + file.insertions, 0);
            const deletions = diffReport.files.reduce((total, file) => total + file.deletions, 0);
            const binaryFiles = diffReport.files.filter((file) => file.binary).length;
            lines.push(
                `Diff summary: ${diffReport.files.length} files, +${insertions}, -${deletions}, binary ${binaryFiles}`,
            );
        } else if (diffReport.status === 'error') {
            lines.push(`Diff summary failed: ${diffReport.reason}`);
        }

        const branchReport = await createGitBranchSummaryReport(projectPath);
        if (branchReport.status === 'ready' && branchReport.isRepository) {
            lines.push(
                `Branches: ${branchReport.branches.length} local, current ${branchReport.current ?? 'detached'}`,
            );
        } else if (branchReport.status === 'error') {
            lines.push(`Branch summary failed: ${branchReport.reason}`);
        }

        const remoteReport = await createGitRemoteSummaryReport(projectPath);
        if (remoteReport.status === 'ready' && remoteReport.isRepository) {
            const remotePolicy = createGitRemotePolicyReport(remoteReport.remotes);
            lines.push(
                `Remotes: ${remoteReport.remotes.length} configured, policy ready=${remotePolicy.summary.ready}, review=${remotePolicy.summary.review}, blocked=${remotePolicy.summary.blocked}`,
                ...remoteReport.remotes.map((remote) => (
                    `${remote.name}: fetch=${remote.fetchUrl ?? 'none'} push=${remote.pushUrl ?? 'none'}`
                )),
                ...remotePolicy.entries.map((entry) => (
                    `${entry.name}: ${entry.status}, transport=${entry.transport}, credentials=${entry.credentialMode} - ${entry.note}`
                )),
            );
        } else if (remoteReport.status === 'error') {
            lines.push(`Remote summary failed: ${remoteReport.reason}`);
        }

        executeConsoleMessageAction('editor', 'info', lines.join('\n'));
    }, [projectPath]);

    return {
        showGitCheckoutBranch: handleGitCheckoutBranch,
        showGitCommitStaged: handleGitCommitStaged,
        showGitCreateBranch: handleGitCreateBranch,
        showGitIntegrationReport: handleShowGitIntegrationReport,
        showGitPushCurrentBranch: handleGitPushCurrentBranch,
        showGitPushPreflight: handleGitPushPreflight,
        showGitStageAll: handleGitStageAll,
        showGitStatusReport: handleShowGitStatusReport,
    };
}
