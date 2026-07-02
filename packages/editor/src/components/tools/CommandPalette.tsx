import { type KeyboardEventHandler, useCallback, useEffect, useRef, useState } from 'react';

import { createBrowserParityReport } from '../../services/browserParityReport';
import {
    executeContentMigrationCommand,
    formatContentMigrationCommandStatus,
    getContentMigrationCommandStatusTone,
} from '../../services/contentMigrationCommand';
import { confirmEditorAction } from '../../services/editorDialogs';
import {
    formatEditorUpdateFlowResult,
    formatEditorUpdateInstallPrompt,
    getEditorUpdateFlowResultTone,
    runEditorUpdateCheck,
} from '../../services/editorUpdateClient';
import { createEditorUpdateDiagnosticsReport } from '../../services/editorUpdateDiagnostics';
import { fsOpenPath } from '../../services/fs';
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
import {
    createCommandPaletteAccessibilityState,
    createCommandPaletteOptionAccessibility,
} from './commandPaletteAccessibilityModel';
import { buildCommandPaletteActions } from './commandPaletteActionsModel';
import { executeSelectedAction, reduceCommandPaletteKey } from './commandPaletteInteractionModel';
import {
    clampRenderSelection,
    filterActions,
    openInitialProjectEntry,
    shouldShowEmptyActions,
    toRenderableActions,
} from './commandPaletteModel';
import { useCommandPaletteGitActions } from './useCommandPaletteGitActions';

type Properties = {
    onRequestClose: () => void;
    uiScale: number;
};

export function CommandPalette({ onRequestClose, uiScale }: Properties) {
    const previousFocusReference = useRef<HTMLElement | undefined>(getActiveHTMLElement());
    const [query, setQuery] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);

    useEffect(() => () => {
        const previousFocus = previousFocusReference.current;
        if (previousFocus?.isConnected) {
            previousFocus.focus();
        }
    }, []);

    const activeFile = useProjectStore((state) => state.activeFile);
    const projectPath = useProjectStore((state) => state.projectPath);
    const saveActiveFileFromCurrentScript = useProjectStore((state) => state.saveActiveFileFromCurrentScript);
    const saveAllDirtyFiles = useProjectStore((state) => state.saveAllDirtyFiles);

    const clearAllBreakpoints = useEditorStore((state) => state.clearAllBreakpoints);
    const announceOperationStatus = useEditorStore((state) => state.announceOperationStatus);
    const captureDockLayoutJson = useEditorStore((state) => state.captureDockLayoutJson);
    const isPlaybackPaused = useEditorStore((state) => state.isPlaybackPaused);
    const markManualSave = useEditorStore((state) => state.markManualSave);
    const openExportGameModal = useEditorStore((state) => state.openExportGameModal);
    const openGlobalSearchPopup = useEditorStore((state) => state.openGlobalSearchPopup);
    const openGlobalSearchReplacePopup = useEditorStore((state) => state.openGlobalSearchReplacePopup);
    const openNewProjectModal = useEditorStore((state) => state.openNewProjectModal);
    const openReleaseNotesModal = useEditorStore((state) => state.openReleaseNotesModal);
    const openSettingsModal = useEditorStore((state) => state.openSettingsModal);
    const setDockLayoutJson = useEditorStore((state) => state.setDockLayoutJson);
    const setThemeKey = useEditorStore((state) => state.setThemeKey);
    const themeKey = useEditorStore((state) => state.themeKey);
    const activeDockLayoutPresetId = useSettingsStore((state) => state.activeDockLayoutPresetId);
    const recentProjects = useSettingsStore((state) => state.recentProjects);
    const checkForUpdatesOnStartup = useSettingsStore((state) => state.checkForUpdatesOnStartup);
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
            announceOperationStatus('Content migration started. The editor remains usable while files are checked.');
            markManualSave();
            await saveAllDirtyFiles();

            const result = await executeContentMigrationCommand(projectPath);
            announceOperationStatus(
                formatContentMigrationCommandStatus(result),
                getContentMigrationCommandStatusTone(result),
            );
            if (result.status === 'applied' || result.status === 'conflicted') {
                await useProjectStore.getState().loadManifest();
            }
        } catch (error) {
            console.error('Content migration from command palette failed:', error);
            announceOperationStatus(`Content migration failed: ${error instanceof Error ? error.message : String(error)}`, 'error');
        }
    }, [announceOperationStatus, markManualSave, projectPath, saveAllDirtyFiles]);

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

    const handleCheckForUpdates = useCallback(async () => {
        try {
            announceOperationStatus('Checking for editor updates...');
            const result = await runEditorUpdateCheck({
                confirmInstall: (update) => confirmEditorAction({
                    cancelText: 'Later',
                    confirmText: 'Install',
                    message: formatEditorUpdateInstallPrompt(update),
                    title: 'Install Editor Update',
                }),
                onProgress: ({ downloadedBytes, totalBytes }) => {
                    if (!totalBytes) return;
                    const percent = Math.min(100, Math.round((downloadedBytes / totalBytes) * 100));
                    announceOperationStatus(`Downloading editor update... ${percent}%`);
                },
            });
            announceOperationStatus(formatEditorUpdateFlowResult(result), getEditorUpdateFlowResultTone(result));
        } catch (error) {
            console.error('Editor update check from command palette failed:', error);
            announceOperationStatus(`Editor update check failed: ${error instanceof Error ? error.message : String(error)}`, 'error');
        }
    }, [announceOperationStatus]);

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

    const handleShowEditorUpdateDiagnostics = useCallback(() => {
        const report = createEditorUpdateDiagnosticsReport({
            checkForUpdatesOnStartup,
            currentVersion: __ZERITH_EDITOR_VERSION__,
            runtime: isTauriRuntime() ? 'desktop' : 'browser',
        });
        executeConsoleMessageAction('editor', 'info', report);
    }, [checkForUpdatesOnStartup]);

    const gitActions = useCommandPaletteGitActions(projectPath);

    const actionDeps = {
        activeDockLayoutPresetId,
        activeFile,
        addRecentProject,
        availableThemeKeys,
        captureDockLayoutJson,
        checkForEditorUpdates: handleCheckForUpdates,
        clearAllBreakpoints,
        closeProject: executeCloseProjectAction,
        deleteDockLayoutPreset,
        dockLayoutPresets,
        editorUpdatesSupported: isTauriRuntime(),
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
        openReleaseNotesModal,
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
        showEditorUpdateDiagnostics: handleShowEditorUpdateDiagnostics,
        showGitCheckoutBranch: gitActions.showGitCheckoutBranch,
        showGitCommitStaged: gitActions.showGitCommitStaged,
        showGitCreateBranch: gitActions.showGitCreateBranch,
        showGitIntegrationReport: gitActions.showGitIntegrationReport,
        showGitPushCurrentBranch: gitActions.showGitPushCurrentBranch,
        showGitPushPreflight: gitActions.showGitPushPreflight,
        showGitStageAll: gitActions.showGitStageAll,
        showGitStatusReport: gitActions.showGitStatusReport,
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
    const accessibility = createCommandPaletteAccessibilityState({
        actionCount: renderableActions.length,
        selectedIndex: clampedSelectedIndex,
    });

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
                {...accessibility.dialog}
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
                    {...accessibility.input}
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

                <div
                    {...accessibility.listbox}
                    className="zerith-scrollbar"
                    style={{ maxHeight: `min(60vh, ${500 * uiScale}px)`, overflowY: 'auto' }}
                >
                    {showEmptyState && (
                        <div
                            {...accessibility.status}
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
                        const isDisabled = Boolean(action.disabledReason);
                        return (
                            <button
                                {...createCommandPaletteOptionAccessibility(index, isActive)}
                                disabled={isDisabled}
                                key={action.id}
                                onClick={() => {
                                    handleActionClick(index);
                                }}
                                style={{
                                    alignItems: 'center',
                                    background: isActive ? t.bg.selected : 'transparent',
                                    border: 'none',
                                    color: isDisabled ? t.text.faint : (isActive ? t.text.primary : t.text.normal),
                                    cursor: isDisabled ? 'not-allowed' : 'pointer',
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
                                <span style={{ color: isDisabled ? t.accent.yellow : t.text.muted, fontSize: `${11 * uiScale}px` }}>
                                    {action.disabledReason ?? action.hintText}
                                </span>
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

function getActiveHTMLElement(): HTMLElement | undefined {
    const activeElement = globalThis.document?.activeElement;
    return activeElement instanceof HTMLElement ? activeElement : undefined;
}
