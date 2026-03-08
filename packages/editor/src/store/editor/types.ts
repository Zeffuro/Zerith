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
    moveQuickCommandType: (type: NonMacroEditorCommandType, direction: 'left' | 'right') => void;
    playFromIndex: number | undefined;
    playTrigger: number;
    quickCommandTypes: NonMacroEditorCommandType[];
    setQuickCommandTypes: (types: NonMacroEditorCommandType[]) => void;
    stopTrigger: number;
    toggleQuickCommandType: (type: NonMacroEditorCommandType) => void;
    triggerPlay: () => void;
    triggerPlayFrom: (index: number) => void;
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
    isMuted: boolean;
    setThemeKey: (key: string) => void;
    setUiScale: (scale: number) => void;
    setWindowState: (state: EditorWindowState) => void;
    themeKey: string;
    toggleMute: () => void;
    uiScale: number;
    windowState: EditorWindowState;
}


