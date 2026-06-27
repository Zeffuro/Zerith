import { type KeyboardEventHandler, useCallback, useState } from 'react';

import { createBrowserParityReport } from '../../services/browserParityReport';
import { executeContentMigrationCommand } from '../../services/contentMigrationCommand';
import { refreshProjectTree } from '../../services/explorerFileActions';
import { fsOpenPath } from '../../services/fs';
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
import { openLocalizationWorkbenchTab } from '../../services/localizationWorkbench';
import { openProjectEntry } from '../../services/openProjectEntry';
import { executeProjectValidationCommand } from '../../services/projectValidationCommand';
import { isTauriRuntime } from '../../services/runtime/runtimeEnvironment';
import { saveProjectAs } from '../../services/saveProjectAs';
import { executeConsoleMessageAction } from '../../store/actions/consoleMessageActions';
import { executeCloseProjectAction, executeOpenProjectInCurrentWindow } from '../../store/actions/projectOpenActions';
import { useProjectStore } from '../../store/storeBootstrap';
import { useEditorStore } from '../../store/useEditorStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { editorTheme as t } from '../../theme/editorTheme';
import { getThemeRegistry } from '../../theme/themeRegistry';
import { buildCommandPaletteActions } from './commandPaletteActionsModel';
import { executeSelectedAction, reduceCommandPaletteKey } from './commandPaletteInteractionModel';
import {
    clampRenderSelection,
    filterActions,
    openInitialProjectEntry,
    shouldShowEmptyActions,
    toRenderableActions,
} from './commandPaletteModel';

type Properties = {
    onRequestClose: () => void;
    uiScale: number;
};

export function CommandPalette({ onRequestClose, uiScale }: Properties) {
    const [query, setQuery] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);

    const activeFile = useProjectStore((state) => state.activeFile);
    const projectPath = useProjectStore((state) => state.projectPath);
    const saveActiveFileFromCurrentScript = useProjectStore((state) => state.saveActiveFileFromCurrentScript);
    const saveAllDirtyFiles = useProjectStore((state) => state.saveAllDirtyFiles);

    const clearAllBreakpoints = useEditorStore((state) => state.clearAllBreakpoints);
    const captureDockLayoutJson = useEditorStore((state) => state.captureDockLayoutJson);
    const isPlaybackPaused = useEditorStore((state) => state.isPlaybackPaused);
    const markManualSave = useEditorStore((state) => state.markManualSave);
    const openExportGameModal = useEditorStore((state) => state.openExportGameModal);
    const openGlobalSearchPopup = useEditorStore((state) => state.openGlobalSearchPopup);
    const openGlobalSearchReplacePopup = useEditorStore((state) => state.openGlobalSearchReplacePopup);
    const openNewProjectModal = useEditorStore((state) => state.openNewProjectModal);
    const openSettingsModal = useEditorStore((state) => state.openSettingsModal);
    const setDockLayoutJson = useEditorStore((state) => state.setDockLayoutJson);
    const setThemeKey = useEditorStore((state) => state.setThemeKey);
    const themeKey = useEditorStore((state) => state.themeKey);
    const activeDockLayoutPresetId = useSettingsStore((state) => state.activeDockLayoutPresetId);
    const recentProjects = useSettingsStore((state) => state.recentProjects);
    const customThemes = useSettingsStore((state) => state.customThemes);
    const deleteDockLayoutPreset = useSettingsStore((state) => state.deleteDockLayoutPreset);
    const dockLayoutPresets = useSettingsStore((state) => state.dockLayoutPresets);
    const saveDockLayoutPreset = useSettingsStore((state) => state.saveDockLayoutPreset);
    const setActiveDockLayoutPresetId = useSettingsStore((state) => state.setActiveDockLayoutPresetId);
    const resetDockLayout = useEditorStore((state) => state.resetDockLayout);
    const addRecentProject = useEditorStore((state) => state.addRecentProject);
    const triggerPause = useEditorStore((state) => state.triggerPause);
    const triggerPlay = useEditorStore((state) => state.triggerPlay);
    const triggerResume = useEditorStore((state) => state.triggerResume);
    const triggerStep = useEditorStore((state) => state.triggerStep);
    const triggerStop = useEditorStore((state) => state.triggerStop);
    const playTrigger = useEditorStore((state) => state.playTrigger);
    const stopTrigger = useEditorStore((state) => state.stopTrigger);

    const isRunning = playTrigger > stopTrigger;
    const availableThemeKeys = getThemeRegistry(customThemes).map((theme) => theme.key);

    const handleOpenInitialProjectEntry = useCallback(async () => {
        const { expandToPath, manifest, projectPath } = useProjectStore.getState();
        await openInitialProjectEntry({
            expandToPath,
            manifest,
            openProjectEntry,
            projectPath,
        });
    }, []);

    const handleSaveProjectAs = useCallback(async () => {
        if (!projectPath) return;

        try {
            markManualSave();
            await saveAllDirtyFiles();

            const result = await saveProjectAs(projectPath);
            if (!result) return;

            const opened = await executeOpenProjectInCurrentWindow(result.manifestPath, {
                allowNewWindow: false,
                prompt: false,
            });
            if (opened.status !== 'opened-current') return;
            if (isTauriRuntime()) addRecentProject(result.manifestPath);
            await handleOpenInitialProjectEntry();
        } catch (error) {
            console.error('Save Project As from command palette failed:', error);
        }
    }, [addRecentProject, handleOpenInitialProjectEntry, markManualSave, projectPath, saveAllDirtyFiles]);

    const handleOpenProjectFolder = useCallback(async () => {
        if (!projectPath) return;

        try {
            await fsOpenPath(projectPath);
        } catch (error) {
            console.error('Open project folder from command palette failed:', error);
        }
    }, [projectPath]);

    const handleMigrateProjectContent = useCallback(async () => {
        if (!projectPath) return;

        try {
            markManualSave();
            await saveAllDirtyFiles();

            const result = await executeContentMigrationCommand(projectPath);
            if (result.status === 'applied' || result.status === 'conflicted') {
                await useProjectStore.getState().loadManifest();
            }
        } catch (error) {
            console.error('Content migration from command palette failed:', error);
        }
    }, [markManualSave, projectPath, saveAllDirtyFiles]);

    const handleValidateProjectContent = useCallback(async () => {
        if (!projectPath) return;

        try {
            markManualSave();
            await saveAllDirtyFiles();
            await executeProjectValidationCommand(projectPath);
        } catch (error) {
            console.error('Project validation from command palette failed:', error);
        }
    }, [markManualSave, projectPath, saveAllDirtyFiles]);

    const handleOpenLocalizationEditor = useCallback(() => {
        openLocalizationWorkbenchTab({ query: '' });
    }, []);

    const handleShowBrowserParityReport = useCallback(() => {
        const runtime = isTauriRuntime() ? 'desktop' : 'browser';
        const browserGlobal = globalThis as { showDirectoryPicker?: unknown };
        const report = createBrowserParityReport({
            browserFileSystemAccess: typeof browserGlobal.showDirectoryPicker === 'function',
            runtime,
        });
        const lines = [
            `Editor runtime: ${runtime}`,
            `Supported: ${report.summary.supported}, limited: ${report.summary.limited}, unsupported: ${report.summary.unsupported}`,
            ...report.capabilities.map((capability) => (
                `${capability.id}: desktop=${capability.desktop}, browser=${capability.browser} - ${capability.note}`
            )),
            `Export parity: matched=${report.exportComparison.summary.matched}, browser-limited=${report.exportComparison.summary['browser-limited']}, desktop-only=${report.exportComparison.summary['desktop-only']}`,
            ...report.exportComparison.features.map((feature) => (
                `${feature.id}: ${feature.status} - desktop=${feature.desktop} browser=${feature.browser} ${feature.note}`
            )),
        ];

        executeConsoleMessageAction('editor', 'info', lines.join('\n'));
    }, []);

    const handleShowGitIntegrationReport = useCallback(() => {
        const runtime = isTauriRuntime() ? 'desktop' : 'browser';
        const report = createGitIntegrationReport({ runtime });
        const lines = [
            `Editor runtime: ${runtime}`,
            `Recommended: ${report.summary.recommended}, limited: ${report.summary.limited}, deferred: ${report.summary.deferred}, unsupported: ${report.summary.unsupported}`,
            `Next: ${report.recommendedNextStep}`,
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
            `Repository: ${report.repositoryRoot ?? projectPath}`,
            `Branch: ${report.branch ?? 'unknown'}, ahead: ${report.ahead}, behind: ${report.behind}`,
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
            lines.push(
                `Diff summary: files=${diffReport.files.length}, +${insertions}, -${deletions}`,
                ...diffReport.files.slice(0, entryLimit).map((file) => (
                    `${file.binary ? 'binary' : `+${file.insertions}/-${file.deletions}`} ${file.path}`
                )),
                ...(diffReport.files.length > entryLimit ? [`... ${diffReport.files.length - entryLimit} more diff files`] : []),
            );
        } else if (diffReport.status === 'error') {
            lines.push(`Diff summary failed: ${diffReport.reason}`);
        }

        const branchReport = await createGitBranchSummaryReport(projectPath);
        if (branchReport.status === 'ready' && branchReport.isRepository) {
            const branchLimit = 20;
            lines.push(
                `Branches: ${branchReport.branches.length}, current: ${branchReport.current ?? 'unknown'}`,
                ...branchReport.branches.slice(0, branchLimit).map((branch) => (
                    `${branch.current ? '*' : ' '} ${branch.name}${branch.upstream ? ` -> ${branch.upstream}` : ''}`
                )),
                ...(branchReport.branches.length > branchLimit ? [`... ${branchReport.branches.length - branchLimit} more branches`] : []),
            );
        } else if (branchReport.status === 'error') {
            lines.push(`Branch summary failed: ${branchReport.reason}`);
        }

        const remoteReport = await createGitRemoteSummaryReport(projectPath);
        if (remoteReport.status === 'ready' && remoteReport.isRepository) {
            const remoteLimit = 20;
            const remotePolicy = createGitRemotePolicyReport(remoteReport.remotes);
            lines.push(
                `Remotes: ${remoteReport.remotes.length}`,
                ...remoteReport.remotes.slice(0, remoteLimit).map((remote) => (
                    `${remote.name}: fetch=${remote.fetchUrl ?? 'none'} push=${remote.pushUrl ?? 'none'}`
                )),
                ...(remoteReport.remotes.length > remoteLimit ? [`... ${remoteReport.remotes.length - remoteLimit} more remotes`] : []),
                `Remote policy: ready=${remotePolicy.summary.ready}, review=${remotePolicy.summary.review}, blocked=${remotePolicy.summary.blocked}${remotePolicy.recommendedRemote ? `, recommended=${remotePolicy.recommendedRemote}` : ''}`,
                ...remotePolicy.entries.slice(0, remoteLimit).map((entry) => (
                    `${entry.name}: ${entry.status}, transport=${entry.transport}, credentials=${entry.credentialMode} - ${entry.note}`
                )),
                ...(remotePolicy.entries.length > remoteLimit ? [`... ${remotePolicy.entries.length - remoteLimit} more remote policies`] : []),
            );
        } else if (remoteReport.status === 'error') {
            lines.push(`Remote summary failed: ${remoteReport.reason}`);
        }

        executeConsoleMessageAction('editor', 'info', lines.join('\n'));
    }, [projectPath]);

    const actionDeps = {
        activeDockLayoutPresetId,
        activeFile,
        addRecentProject,
        availableThemeKeys,
        captureDockLayoutJson,
        clearAllBreakpoints,
        closeProject: executeCloseProjectAction,
        deleteDockLayoutPreset,
        dockLayoutPresets,
        isPlaybackPaused,
        isRunning,
        markManualSave,
        migrateProjectContent: handleMigrateProjectContent,
        openExportGameModal,
        openGlobalSearchPopup,
        openGlobalSearchReplacePopup,
        openInitialProjectEntry: handleOpenInitialProjectEntry,
        openLocalizationEditor: handleOpenLocalizationEditor,
        openNewProjectModal,
        openProjectFolder: handleOpenProjectFolder,
        openProjectInCurrentWindow: executeOpenProjectInCurrentWindow,
        openSettingsModal,
        projectPath,
        recentProjects: isTauriRuntime() ? recentProjects : [],
        resetDockLayout,
        saveActiveFileFromCurrentScript,
        saveAllDirtyFiles,
        saveDockLayoutPreset,
        saveProjectAs: handleSaveProjectAs,
        setActiveDockLayoutPresetId,
        setDockLayoutJson,
        setThemeKey,
        showBrowserParityReport: handleShowBrowserParityReport,
        showGitCheckoutBranch: handleGitCheckoutBranch,
        showGitCommitStaged: handleGitCommitStaged,
        showGitCreateBranch: handleGitCreateBranch,
        showGitIntegrationReport: handleShowGitIntegrationReport,
        showGitPushCurrentBranch: handleGitPushCurrentBranch,
        showGitStageAll: handleGitStageAll,
        showGitStatusReport: handleShowGitStatusReport,
        themeKey,
        triggerPause,
        triggerPlay,
        triggerResume,
        triggerStep,
        triggerStop,
        validateProjectContent: handleValidateProjectContent,
    };

    const filteredActions = filterActions(buildCommandPaletteActions(actionDeps), query);

    const renderableActions = toRenderableActions(filteredActions);
    const clampedSelectedIndex = clampRenderSelection(selectedIndex, renderableActions.length);
    const showEmptyState = shouldShowEmptyActions(renderableActions.length);

    const handleActionClick = (index: number) => {
        void executeSelectedAction(filteredActions, index, onRequestClose);
    };

    const handleInputKeyDown: KeyboardEventHandler<HTMLInputElement> = (event) => {
        const interaction = reduceCommandPaletteKey(event.key, {
            actionCount: filteredActions.length,
            selectedIndex,
        });
        if (!interaction) return;

        event.preventDefault();

        if (interaction.kind === 'select') {
            setSelectedIndex(interaction.nextIndex);
            return;
        }

        if (interaction.kind === 'execute') {
            void executeSelectedAction(filteredActions, interaction.index, onRequestClose);
            return;
        }

        onRequestClose();
    };

    return (
        <div
            onClick={onRequestClose}
            style={{
                alignItems: 'flex-start',
                background: 'rgba(0, 0, 0, 0.45)',
                display: 'flex',
                height: '100%',
                justifyContent: 'center',
                left: 0,
                position: 'absolute',
                top: 0,
                width: '100%',
                zIndex: 5200,
            }}
        >
            <div
                onClick={(event) => event.stopPropagation()}
                style={{
                    background: t.bg.popup,
                    border: `1px solid ${t.border.normal}`,
                    borderRadius: t.radius.md,
                    boxShadow: t.shadow.popupStrong,
                    marginTop: `${52 * uiScale}px`,
                    maxHeight: `min(70vh, ${560 * uiScale}px)`,
                    maxWidth: `min(92vw, ${820 * uiScale}px)`,
                    overflow: 'hidden',
                    width: `min(92vw, ${680 * uiScale}px)`,
                }}
            >
                <input
                    autoFocus
                    onChange={(event) => {
                        setQuery(event.target.value);
                        setSelectedIndex(0);
                    }}
                    onKeyDown={handleInputKeyDown}
                    placeholder="Type an action (e.g. Save All, Play, Reset Layout)"
                    style={{
                        background: t.bg.panel,
                        border: 'none',
                        borderBottom: `1px solid ${t.border.subtle}`,
                        color: t.text.normal,
                        fontSize: `${13 * uiScale}px`,
                        outline: 'none',
                        padding: `${10 * uiScale}px ${12 * uiScale}px`,
                        width: '100%',
                    }}
                    value={query}
                />

                <div className="zerith-scrollbar" style={{ maxHeight: `min(60vh, ${500 * uiScale}px)`, overflowY: 'auto' }}>
                    {showEmptyState && (
                        <div
                            style={{
                                color: t.text.faint,
                                fontStyle: 'italic',
                                padding: `${10 * uiScale}px ${12 * uiScale}px`,
                            }}
                        >
                            No matching commands
                        </div>
                    )}

                    {renderableActions.map((action, index) => {
                        const isActive = clampedSelectedIndex === index;
                        return (
                            <button
                                key={action.id}
                                onClick={() => {
                                    handleActionClick(index);
                                }}
                                style={{
                                    alignItems: 'center',
                                    background: isActive ? t.bg.selected : 'transparent',
                                    border: 'none',
                                    color: isActive ? t.text.primary : t.text.normal,
                                    cursor: 'pointer',
                                    display: 'grid',
                                    gap: `${10 * uiScale}px`,
                                    gridTemplateColumns: '1fr auto',
                                    padding: `${8 * uiScale}px ${12 * uiScale}px`,
                                    textAlign: 'left',
                                    width: '100%',
                                }}
                                type="button"
                            >
                                <span>{action.label}</span>
                                <span style={{ color: t.text.muted, fontSize: `${11 * uiScale}px` }}>{action.hintText}</span>
                            </button>
                        );
                    })}
                </div>

                <div
                    style={{
                        borderTop: `1px solid ${t.border.subtle}`,
                        color: t.text.muted,
                        fontSize: `${11 * uiScale}px`,
                        padding: `${8 * uiScale}px ${12 * uiScale}px`,
                    }}
                >
                    Enter to run - Esc to close - Up/Down to navigate
                </div>
            </div>
        </div>
    );
}
