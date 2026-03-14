import type { CommandPaletteActionDeps } from './commandPaletteActionsModel';

type BuildCommandPaletteActionsDepsArguments = {
    activeFile: CommandPaletteActionDeps['activeFile'];
    addRecentProject: CommandPaletteActionDeps['addRecentProject'];
    clearAllBreakpoints: CommandPaletteActionDeps['clearAllBreakpoints'];
    isPlaybackPaused: CommandPaletteActionDeps['isPlaybackPaused'];
    isRunning: CommandPaletteActionDeps['isRunning'];
    markManualSave: CommandPaletteActionDeps['markManualSave'];
    openGlobalSearchPopup: CommandPaletteActionDeps['openGlobalSearchPopup'];
    openGlobalSearchReplacePopup: CommandPaletteActionDeps['openGlobalSearchReplacePopup'];
    openInitialProjectEntry: CommandPaletteActionDeps['openInitialProjectEntry'];
    openProjectFromManifest: CommandPaletteActionDeps['openProjectFromManifest'];
    openSettingsModal: CommandPaletteActionDeps['openSettingsModal'];
    recentProjects: CommandPaletteActionDeps['recentProjects'];
    resetDockLayout: CommandPaletteActionDeps['resetDockLayout'];
    saveActiveFileFromCurrentScript: CommandPaletteActionDeps['saveActiveFileFromCurrentScript'];
    saveAllDirtyFiles: CommandPaletteActionDeps['saveAllDirtyFiles'];
    triggerPause: CommandPaletteActionDeps['triggerPause'];
    triggerPlay: CommandPaletteActionDeps['triggerPlay'];
    triggerResume: CommandPaletteActionDeps['triggerResume'];
    triggerStep: CommandPaletteActionDeps['triggerStep'];
    triggerStop: CommandPaletteActionDeps['triggerStop'];
};

export function buildCommandPaletteActionsDeps(arguments_: BuildCommandPaletteActionsDepsArguments): CommandPaletteActionDeps {
    return {
        activeFile: arguments_.activeFile,
        addRecentProject: arguments_.addRecentProject,
        clearAllBreakpoints: arguments_.clearAllBreakpoints,
        isPlaybackPaused: arguments_.isPlaybackPaused,
        isRunning: arguments_.isRunning,
        markManualSave: arguments_.markManualSave,
        openGlobalSearchPopup: arguments_.openGlobalSearchPopup,
        openGlobalSearchReplacePopup: arguments_.openGlobalSearchReplacePopup,
        openInitialProjectEntry: arguments_.openInitialProjectEntry,
        openProjectFromManifest: arguments_.openProjectFromManifest,
        openSettingsModal: arguments_.openSettingsModal,
        recentProjects: arguments_.recentProjects,
        resetDockLayout: arguments_.resetDockLayout,
        saveActiveFileFromCurrentScript: arguments_.saveActiveFileFromCurrentScript,
        saveAllDirtyFiles: arguments_.saveAllDirtyFiles,
        triggerPause: arguments_.triggerPause,
        triggerPlay: arguments_.triggerPlay,
        triggerResume: arguments_.triggerResume,
        triggerStep: arguments_.triggerStep,
        triggerStop: arguments_.triggerStop,
    };
}

