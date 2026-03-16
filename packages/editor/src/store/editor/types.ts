import type { NonMacroEditorCommandType } from '../../plugins/types';
import type { ScriptPath } from '../../utils/scriptPathUtilities';

export interface ClipboardValidationAssetSlice {
    clearValidationErrors: () => void;
    clipboardNode: unknown;
    selectedAssetPath: string | undefined;
    setClipboardNode: (node: unknown) => void;
    setSelectedAssetPath: (path: string | undefined) => void;
    setValidationErrors: (errors: Record<string, string[]>) => void;
    validationErrors: Record<string, string[]>;
}

export type DeleteRequestSource = 'click' | 'keyboard';

export interface DockLayoutSlice {
    dockLayoutJson: unknown;
    dockLayoutVersion: number;
    resetDockLayout: () => void;
    setDockLayoutJson: (json: unknown) => void;
}

export type EditorSet = (
    partial: ((state: EditorState) => Partial<EditorState>) | Partial<EditorState>
) => void;

export interface EditorState
    extends ClipboardValidationAssetSlice,
        DockLayoutSlice,
        PlaybackQuickCommandsSlice,
        SelectionSlice,
        UiPrefsSlice {}

export type EditorWindowState = {
    height: number;
    maximized: boolean;
    width: number;
    x: number;
    y: number;
} | undefined;

export type GlobalSearchLaunchMode = 'find' | 'replace';

export type PendingDeleteRequest = {
    paths: ScriptPath[];
    source: DeleteRequestSource;
} | undefined;

export interface PlaybackQuickCommandsSlice {
    activeExecutionPath: ScriptPath | undefined;
    breakpoints: Record<string, number[]>;
    clearActiveExecutionPath: () => void;
    clearAllBreakpoints: () => void;
    isPlaybackPaused: boolean;
    moveQuickCommandType: (type: NonMacroEditorCommandType, direction: 'left' | 'right') => void;
    pauseTrigger: number;
    playFromIndex: number | undefined;
    playTrigger: number;
    quickCommandTypes: NonMacroEditorCommandType[];
    resumeTrigger: number;
    setActiveExecutionPath: (path: ScriptPath | undefined) => void;
    setPlaybackPaused: (paused: boolean) => void;
    setQuickCommandTypes: (types: NonMacroEditorCommandType[]) => void;
    stepTrigger: number;
    stopTrigger: number;
    toggleBreakpoint: (filePath: string, index: number) => void;
    toggleQuickCommandType: (type: NonMacroEditorCommandType) => void;
    triggerPause: () => void;
    triggerPlay: () => void;
    triggerPlayFrom: (index: number) => void;
    triggerResume: () => void;
    triggerStep: () => void;
    triggerStop: () => void;
}

export type RecentProject = {
    lastOpened: number;
    name: string;
    path: string;
};

export interface SelectionSlice {
    clearDeleteRequest: () => void;
    clearSelection: () => void;
    pendingDeleteRequest: PendingDeleteRequest;
    requestDelete: (paths: ScriptPath[], source?: DeleteRequestSource) => void;
    selectedNodePaths: ScriptPath[];
    selectionAnchorPath: ScriptPath | undefined;
    setSelectedNodePaths: (paths: ScriptPath[]) => void;
    setSelectionAnchorPath: (path: ScriptPath | undefined) => void;
    toggleSelectedNodePath: (path: ScriptPath) => void;
}

export interface UiPrefsSlice {
    addRecentProject: (manifestPath: string) => void;
    autosaveEnabled: boolean;
    autosaveIntervalMs: number;
    clearRecentProjects: () => void;
    closeCommandPalette: () => void;
    closeExportGameModal: () => void;
    closeGlobalSearchPopup: () => void;
    closeSettingsModal: () => void;
    globalSearchLaunchMode: GlobalSearchLaunchMode;
    isCommandPaletteOpen: boolean;
    isExportGameModalOpen: boolean;
    isGlobalSearchPopupOpen: boolean;
    isMuted: boolean;
    isSettingsModalOpen: boolean;
    lastManualSaveAt: number;
    markManualSave: () => void;
    openCommandPalette: () => void;
    openExportGameModal: () => void;
    openGlobalSearchPopup: (mode?: GlobalSearchLaunchMode) => void;
    openGlobalSearchReplacePopup: () => void;
    openSettingsModal: () => void;
    recentProjects: RecentProject[];
    setAutosaveEnabled: (enabled: boolean) => void;
    setAutosaveIntervalMs: (intervalMs: number) => void;
    setThemeKey: (key: string) => void;
    setUiScale: (scale: number) => void;
    setWindowState: (state: EditorWindowState) => void;
    themeKey: string;
    toggleCommandPalette: () => void;
    toggleExportGameModal: () => void;
    toggleGlobalSearchPopup: () => void;
    toggleMute: () => void;
    toggleSettingsModal: () => void;
    uiScale: number;
    windowState: EditorWindowState;
}


