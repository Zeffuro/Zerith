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

export type PendingDeleteRequest = {
    paths: ScriptPath[];
    source: DeleteRequestSource;
} | undefined;

export interface PlaybackQuickCommandsSlice {
    activeExecutionPath: ScriptPath | undefined;
    breakpoints: Record<string, number[]>;
    clearActiveExecutionPath: () => void;
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
    closeGlobalSearchPopup: () => void;
    isGlobalSearchPopupOpen: boolean;
    isMuted: boolean;
    openGlobalSearchPopup: () => void;
    setThemeKey: (key: string) => void;
    setUiScale: (scale: number) => void;
    setWindowState: (state: EditorWindowState) => void;
    themeKey: string;
    toggleGlobalSearchPopup: () => void;
    toggleMute: () => void;
    uiScale: number;
    windowState: EditorWindowState;
}


