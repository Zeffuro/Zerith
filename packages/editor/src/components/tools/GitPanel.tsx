import { ArrowUpFromLine, FolderGit2, GitFork, Plus, RefreshCcw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type {
    GitBranchSummaryReport,
    GitDiffSummaryReport,
    GitRemoteSummaryReport,
    GitStatusReport,
} from '../../services/gitIntegration';

import { refreshProjectTree } from '../../services/explorerFileActions';
import { openGitDiffWorkbenchTab } from '../../services/gitDiffWorkbench';
import {
    createGitBranchReport,
    createGitBranchSummaryReport,
    createGitCheckoutBranchReport,
    createGitCommitStagedReport,
    createGitDiffFileReport,
    createGitDiffSummaryReport,
    createGitInitRepositoryReport,
    createGitPushCurrentBranchReport,
    createGitRemoteSummaryReport,
    createGitStageAllReport,
    createGitStageFileReport,
    createGitStatusReport,
    createGitUnstageFileReport,
} from '../../services/gitIntegration';
import { createGitBackendStrategyReport } from '../../services/gitIntegrationReport';
import { isTauriRuntime } from '../../services/runtime/runtimeEnvironment';
import { executeConsoleMessageAction } from '../../store/actions/consoleMessageActions';
import { useProjectStore } from '../../store/storeBootstrap';
import { useSettingsStore } from '../../store/useSettingsStore';
import { editorTheme as t } from '../../theme/editorTheme';
import { GitPanelChangeGroup } from './GitPanelChangeGroup';
import {
    createGitPanelChangeBuckets,
    createGitPanelChangeSummary,
    createGitPanelPushPreflight,
    createGitPanelRemotePolicy,
    findDefaultGitRemote,
    formatGitBranchLabel,
} from './gitPanelModel';
import {
    GitBackendSection,
    GitBranchesSection,
    GitCommitSection,
    GitPushSection,
    GitRemotesSection,
    GitRepositorySection,
} from './GitPanelSections';
import {
    actionButtonStyle,
    buttonGridStyle,
    emptyStateStyle,
    headerRowStyle,
    iconButtonStyle,
    messageStyle,
    panelStyle,
    secondaryActionButtonStyle,
    sectionStyle,
    sectionTitleStyle,
} from './gitPanelStyles';
import { useGitPanelAutoRefresh } from './useGitPanelAutoRefresh';

type GitPanelAction =
    | 'checkout'
    | 'commit'
    | 'create-branch'
    | 'init'
    | 'push-preflight'
    | 'push'
    | 'refresh'
    | 'stage-file'
    | 'stage'
    | 'unstage-file';

type GitPanelReports = {
    branch: GitBranchSummaryReport | undefined;
    diff: GitDiffSummaryReport | undefined;
    remote: GitRemoteSummaryReport | undefined;
    status: GitStatusReport | undefined;
};

const EMPTY_REPORTS: GitPanelReports = {
    branch: undefined,
    diff: undefined,
    remote: undefined,
    status: undefined,
};

export function GitPanel() {
    const uiScale = useSettingsStore((state) => state.uiScale);
    const projectPath = useProjectStore((state) => state.projectPath);
    const loadManifest = useProjectStore((state) => state.loadManifest);

    const [busyAction, setBusyAction] = useState<GitPanelAction>();
    const [commitDescription, setCommitDescription] = useState('');
    const [commitSummary, setCommitSummary] = useState('');
    const [isLoadingDiff, setIsLoadingDiff] = useState(false);
    const [lastMessage, setLastMessage] = useState<string>();
    const [pushRemoteName, setPushRemoteName] = useState('');
    const [reports, setReports] = useState<GitPanelReports>(EMPTY_REPORTS);
    const [selectedDiffPath, setSelectedDiffPath] = useState<string>();
    const busyActionReference = useRef<GitPanelAction | undefined>(undefined);
    const selectedDiffPathReference = useRef<string | undefined>(undefined);

    const changeBuckets = useMemo(() => createGitPanelChangeBuckets(reports.status), [reports.status]);
    const changeSummary = useMemo(
        () => createGitPanelChangeSummary(reports.status, reports.diff),
        [reports.diff, reports.status],
    );
    const remotePolicy = useMemo(() => createGitPanelRemotePolicy(reports.remote), [reports.remote]);
    const remotes = useMemo(
        () => reports.remote?.status === 'ready' && reports.remote.isRepository ? reports.remote.remotes : [],
        [reports.remote],
    );
    const remoteOptions = useMemo(() => remotes.map((remote) => remote.name), [remotes]);
    const defaultPushRemote = useMemo(() => findDefaultGitRemote(remotes, remotePolicy), [remotePolicy, remotes]);
    const pushPreflight = useMemo(
        () => createGitPanelPushPreflight(remotes, remotePolicy, pushRemoteName),
        [pushRemoteName, remotePolicy, remotes],
    );
    const backendStrategy = useMemo(
        () => createGitBackendStrategyReport({ runtime: isTauriRuntime() ? 'desktop' : 'browser' }),
        [],
    );
    const currentBranchLabel = formatGitBranchLabel(reports.status);
    const isBusy = busyAction !== undefined;
    const isRepository = reports.status?.status === 'ready' && reports.status.isRepository;
    const canInitializeRepository = reports.status?.status === 'ready' && !reports.status.isRepository;
    const canCommit = isRepository && changeBuckets.staged.length > 0 && commitSummary.trim().length > 0;

    useEffect(() => {
        busyActionReference.current = busyAction;
    }, [busyAction]);

    useEffect(() => {
        selectedDiffPathReference.current = selectedDiffPath;
    }, [selectedDiffPath]);

    useEffect(() => {
        if (!isRepository) {
            setPushRemoteName('');
            return;
        }

        if (pushRemoteName && remoteOptions.includes(pushRemoteName)) {
            return;
        }

        setPushRemoteName(remoteOptions.includes(defaultPushRemote) ? defaultPushRemote : remoteOptions[0] ?? '');
    }, [defaultPushRemote, isRepository, pushRemoteName, remoteOptions]);

    const refreshReports = useCallback(async (options: { silent?: boolean; } = {}) => {
        const silent = options.silent === true;
        if (!projectPath) {
            setReports(EMPTY_REPORTS);
            setSelectedDiffPath(undefined);
            if (!silent) {
                setLastMessage('Open a project to inspect Git status.');
            }
            return;
        }

        if (!silent) {
            setBusyAction('refresh');
        }
        try {
            const [status, diff, branch, remote] = await Promise.all([
                createGitStatusReport(projectPath),
                createGitDiffSummaryReport(projectPath),
                createGitBranchSummaryReport(projectPath),
                createGitRemoteSummaryReport(projectPath),
            ]);

            setReports({ branch, diff, remote, status });
            const currentSelectedPath = selectedDiffPathReference.current;
            if (status.status !== 'ready' || !status.isRepository) {
                setSelectedDiffPath(undefined);
            } else if (currentSelectedPath) {
                const stillChanged = status.entries.some((entry) => entry.path === currentSelectedPath);
                if (!stillChanged) {
                    setSelectedDiffPath(undefined);
                }
            }

            if (!silent) {
                setLastMessage(messageFromStatusReport(status, projectPath));
            }
        } finally {
            if (!silent) {
                setBusyAction(undefined);
            }
        }
    }, [projectPath]);

    useEffect(() => {
        void refreshReports();
    }, [refreshReports]);

    useGitPanelAutoRefresh({ busyActionRef: busyActionReference, projectPath, refreshReports });

    const runGitAction = useCallback(async (
        action: GitPanelAction,
        task: () => Promise<string | undefined>,
    ) => {
        if (!projectPath || isBusy) return;

        setBusyAction(action);
        try {
            const message = await task();
            if (message) {
                setLastMessage(message);
                executeConsoleMessageAction('editor', 'info', message);
            }
            setSelectedDiffPath(undefined);
            await refreshReports();
        } catch (error) {
            const message = String(error);
            setLastMessage(message);
            executeConsoleMessageAction('editor', 'error', 'Git action failed:', message);
        } finally {
            setBusyAction(undefined);
        }
    }, [isBusy, projectPath, refreshReports]);

    const loadFileDiff = useCallback(async (path: string) => {
        if (!projectPath) return;

        setSelectedDiffPath(path);
        setIsLoadingDiff(true);
        try {
            const report = await createGitDiffFileReport(projectPath, path);
            if (report.status === 'ready' && report.isRepository) {
                openGitDiffWorkbenchTab({
                    filePath: report.path,
                    projectPath,
                    rawDiff: report.rawDiff,
                    repositoryRoot: report.repositoryRoot,
                });
                setLastMessage(`Opened diff for ${report.path}.`);
            } else if (report.status === 'error' || report.status === 'unsupported') {
                setLastMessage(report.reason);
            } else if (report.status === 'ready') {
                setLastMessage(`No repository diff available for ${path}.`);
            }
        } finally {
            setIsLoadingDiff(false);
        }
    }, [projectPath]);

    const handleInitializeRepository = useCallback(() => {
        void runGitAction('init', async () => {
            if (globalThis.confirm && !globalThis.confirm('Initialize a Git repository in the open project folder?')) {
                return;
            }

            const report = await createGitInitRepositoryReport(projectPath);
            if (report.status === 'initialized') {
                const root = report.repositoryRoot ?? projectPath ?? 'the open project';
                return report.initialized
                    ? `Initialized Git repository at ${root}.`
                    : `Git repository already exists at ${root}.`;
            }

            return report.reason;
        });
    }, [projectPath, runGitAction]);

    const handleCreateBranch = useCallback(() => {
        void runGitAction('create-branch', async () => {
            const branchName = globalThis.prompt?.('Create branch from current HEAD', 'feature/new-branch')?.trim();
            if (!branchName) return;

            const report = await createGitBranchReport(projectPath, branchName);
            if (report.status === 'created') {
                return `Created branch '${report.branchName}' at current HEAD. Current checkout was not changed.`;
            }

            return report.reason;
        });
    }, [projectPath, runGitAction]);

    const handleCheckoutBranch = useCallback(() => {
        void runGitAction('checkout', async () => {
            const defaultBranch = reports.branch?.status === 'ready'
                ? reports.branch.branches.find((branch) => !branch.current)?.name ?? reports.branch.current ?? 'main'
                : 'main';
            const branchName = globalThis.prompt?.('Checkout existing branch', defaultBranch)?.trim();
            if (!branchName) return;

            const report = await createGitCheckoutBranchReport(projectPath, branchName);
            if (report.status === 'checked-out') {
                await refreshProjectTree();
                await loadManifest();
                return `Checked out branch '${report.branchName}'.`;
            }

            return report.reason;
        });
    }, [loadManifest, projectPath, reports.branch, runGitAction]);

    const handleCommitStaged = useCallback(() => {
        void runGitAction('commit', async () => {
            const message = commitSummary.trim();
            if (!message) return 'Commit summary is required.';

            const report = await createGitCommitStagedReport(projectPath, message, {
                description: commitDescription,
            });
            if (report.status === 'committed') {
                setCommitDescription('');
                setCommitSummary('');
                return `Created commit ${report.commitHash}.`;
            }

            return report.reason;
        });
    }, [commitDescription, commitSummary, projectPath, runGitAction]);

    const handlePushCurrentBranch = useCallback(() => {
        void runGitAction('push', async () => {
            const remoteName = pushRemoteName.trim();
            if (!remoteName) return 'Choose a Git remote before pushing.';
            if (!pushPreflight.canPush) return pushPreflight.note;

            const report = await createGitPushCurrentBranchReport(projectPath, { remoteName });
            if (report.status === 'pushed') {
                return `Pushed branch '${report.branchName}' to '${report.remoteName}'.`;
            }

            return report.reason;
        });
    }, [projectPath, pushPreflight, pushRemoteName, runGitAction]);

    const handlePushPreflight = useCallback(() => {
        void runGitAction('push-preflight', async () => {
            const remoteName = pushRemoteName.trim();
            if (!remoteName) return 'Choose a Git remote before checking push credentials.';
            if (!pushPreflight.canPush) return pushPreflight.note;

            const report = await createGitPushCurrentBranchReport(projectPath, {
                dryRun: true,
                remoteName,
            });
            if (report.status === 'pushed') {
                return `Push dry-run succeeded for '${report.branchName}' to '${report.remoteName}'. No commits were uploaded.`;
            }

            return report.reason;
        });
    }, [projectPath, pushPreflight, pushRemoteName, runGitAction]);

    const handleStageProject = useCallback(() => {
        void runGitAction('stage', async () => {
            const report = await createGitStageAllReport(projectPath);
            if (report.status === 'staged') {
                return report.stagedCount === 0
                    ? 'No project Git changes to stage.'
                    : `Staged ${report.stagedCount} project file${report.stagedCount === 1 ? '' : 's'}.`;
            }

            return report.reason;
        });
    }, [projectPath, runGitAction]);

    const handleStageFile = useCallback((path: string) => {
        void runGitAction('stage-file', async () => {
            const report = await createGitStageFileReport(projectPath, path);
            if (report.status === 'staged') {
                return `Staged ${report.path}.`;
            }

            return report.reason;
        });
    }, [projectPath, runGitAction]);

    const handleUnstageFile = useCallback((path: string) => {
        void runGitAction('unstage-file', async () => {
            const report = await createGitUnstageFileReport(projectPath, path);
            if (report.status === 'unstaged') {
                return `Unstaged ${report.path}.`;
            }

            return report.reason;
        });
    }, [projectPath, runGitAction]);

    if (!projectPath) {
        return (
            <div style={panelStyle(uiScale)}>
                <strong>Git</strong>
                <div style={emptyStateStyle(uiScale)}>Open a project to inspect Git status.</div>
            </div>
        );
    }

    return (
        <div className="zerith-scrollbar" style={panelStyle(uiScale)}>
            <div style={headerRowStyle(uiScale)}>
                <div style={{ alignItems: 'center', display: 'flex', gap: `${6 * uiScale}px`, minWidth: 0 }}>
                    <FolderGit2 color={t.syntax.logic} size={16 * uiScale} />
                    <strong>Git</strong>
                </div>
                <button
                    className="toolbar-btn"
                    disabled={isBusy}
                    onClick={() => {
                        void refreshReports();
                    }}
                    style={iconButtonStyle(uiScale, isBusy)}
                    title="Refresh Git status"
                    type="button"
                >
                    <RefreshCcw size={14 * uiScale} />
                </button>
            </div>

            <GitRepositorySection
                changeSummary={changeSummary}
                currentBranchLabel={currentBranchLabel}
                lastMessage={lastMessage}
                statusReport={reports.status}
                uiScale={uiScale}
            />

            <div style={buttonGridStyle(uiScale)}>
                <button className="toolbar-btn" disabled={isBusy || !canInitializeRepository} onClick={handleInitializeRepository} style={actionButtonStyle(uiScale, isBusy || !canInitializeRepository)} type="button">
                    <Plus size={13 * uiScale} />
                    <span>{busyAction === 'init' ? 'Initializing...' : 'Init Repo'}</span>
                </button>
                <button className="toolbar-btn" disabled={isBusy || !isRepository} onClick={handleCreateBranch} style={actionButtonStyle(uiScale, isBusy || !isRepository)} type="button">
                    <Plus size={13 * uiScale} />
                    <span>Branch</span>
                </button>
                <button className="toolbar-btn" disabled={isBusy || !isRepository} onClick={handleCheckoutBranch} style={actionButtonStyle(uiScale, isBusy || !isRepository)} type="button">
                    <GitFork size={13 * uiScale} />
                    <span>Checkout</span>
                </button>
            </div>

            <section style={sectionStyle(uiScale)}>
                <div style={sectionTitleStyle(uiScale)}>Changes</div>
                <GitPanelChangeGroup
                    actionLabel="Stage"
                    actionTitle="Stage file"
                    emptyLabel={isRepository ? 'No unstaged changes.' : 'No repository status available.'}
                    entries={changeBuckets.unstaged}
                    icon="stage"
                    isBusy={isBusy}
                    isLoadingDiff={isLoadingDiff}
                    limit={18}
                    onAction={handleStageFile}
                    onSelect={loadFileDiff}
                    selectedDiffPath={selectedDiffPath}
                    title={`Unstaged Changes (${changeBuckets.unstaged.length})`}
                    uiScale={uiScale}
                />
                {changeBuckets.unstaged.length > 0 ? (
                    <button className="toolbar-btn" disabled={isBusy || !isRepository} onClick={handleStageProject} style={secondaryActionButtonStyle(uiScale, isBusy || !isRepository)} type="button">
                        <ArrowUpFromLine size={12 * uiScale} />
                        <span>{busyAction === 'stage' ? 'Staging...' : 'Stage All Changes'}</span>
                    </button>
                ) : undefined}
                <GitPanelChangeGroup
                    actionLabel="Unstage"
                    actionTitle="Unstage file"
                    emptyLabel={isRepository ? 'No staged changes.' : 'No repository status available.'}
                    entries={changeBuckets.staged}
                    icon="unstage"
                    isBusy={isBusy}
                    isLoadingDiff={isLoadingDiff}
                    limit={18}
                    onAction={handleUnstageFile}
                    onSelect={loadFileDiff}
                    selectedDiffPath={selectedDiffPath}
                    title={`Staged Changes (${changeBuckets.staged.length})`}
                    uiScale={uiScale}
                />
            </section>

            <GitCommitSection
                canCommit={canCommit}
                commitDescription={commitDescription}
                commitSummary={commitSummary}
                isBusy={isBusy}
                isCommitting={busyAction === 'commit'}
                isRepository={isRepository}
                onCommit={handleCommitStaged}
                onDescriptionChange={setCommitDescription}
                onSummaryChange={setCommitSummary}
                stagedCount={changeBuckets.staged.length}
                uiScale={uiScale}
            />

            <GitBranchesSection branchReport={reports.branch} uiScale={uiScale} />

            <GitPushSection
                isBusy={isBusy}
                isCheckingPush={busyAction === 'push-preflight'}
                isPushing={busyAction === 'push'}
                isRepository={isRepository}
                onCheckPush={handlePushPreflight}
                onPush={handlePushCurrentBranch}
                onRemoteChange={setPushRemoteName}
                pushPreflight={pushPreflight}
                remoteOptions={remoteOptions}
                selectedRemoteName={pushRemoteName}
                uiScale={uiScale}
            />

            <GitRemotesSection remotePolicy={remotePolicy} uiScale={uiScale} />

            <GitBackendSection backendStrategy={backendStrategy} uiScale={uiScale} />

            {lastMessage ? <div style={messageStyle(uiScale)}>{lastMessage}</div> : undefined}
        </div>
    );
}

function messageFromStatusReport(report: GitStatusReport, projectPath: string): string {
    if (report.status === 'unsupported') return report.reason;
    if (report.status === 'error') return report.reason;
    if (!report.isRepository) return `Git repository: none found for ${projectPath}`;
    return `Git status refreshed for ${report.repositoryRoot ?? projectPath}.`;
}
