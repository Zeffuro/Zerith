import type { ScriptPath } from '../../utils/scriptPathUtils';
import type { NonMacroEditorCommandType } from '../../plugins/types';

export type EditorSet = (
    partial: Record<string, any> | ((state: Record<string, any>) => Record<string, any>)
) => void;

export type DeleteRequestSource = 'keyboard' | 'click';

export type PendingDeleteRequest = null | {
    paths: ScriptPath[];
    source: DeleteRequestSource;
};

export type EditorWindowState = {
    width: number;
    height: number;
    x: number;
    y: number;
    maximized: boolean;
} | null;

export interface UiPrefsSlice {
    uiScale: number;
    isMuted: boolean;
    windowState: EditorWindowState;
    themeKey: string;
    setUiScale: (scale: number) => void;
    toggleMute: () => void;
    setWindowState: (state: EditorWindowState) => void;
    setThemeKey: (key: string) => void;
}

export interface DockLayoutSlice {
    dockLayoutJson: any;
    dockLayoutVersion: number;
    setDockLayoutJson: (json: any) => void;
    resetDockLayout: () => void;
}

export interface SelectionSlice {
    selectedNodePaths: ScriptPath[];
    selectionAnchorPath: ScriptPath | null;
    pendingDeleteRequest: PendingDeleteRequest;
    setSelectedNodePaths: (paths: ScriptPath[]) => void;
    setSelectionAnchorPath: (path: ScriptPath | null) => void;
    clearSelection: () => void;
    toggleSelectedNodePath: (path: ScriptPath) => void;
    requestDelete: (paths: ScriptPath[], source?: DeleteRequestSource) => void;
    clearDeleteRequest: () => void;
}

export interface PlaybackQuickCommandsSlice {
    playTrigger: number;
    stopTrigger: number;
    playFromIndex: number | null;
    triggerPlayFrom: (index: number) => void;
    triggerPlay: () => void;
    triggerStop: () => void;
    quickCommandTypes: NonMacroEditorCommandType[];
    setQuickCommandTypes: (types: NonMacroEditorCommandType[]) => void;
    toggleQuickCommandType: (type: NonMacroEditorCommandType) => void;
    moveQuickCommandType: (type: NonMacroEditorCommandType, direction: 'left' | 'right') => void;
}

export interface ClipboardValidationAssetSlice {
    clipboardNode: any | null;
    setClipboardNode: (node: any | null) => void;
    validationErrors: Record<string, string[]>;
    setValidationErrors: (errors: Record<string, string[]>) => void;
    clearValidationErrors: () => void;
    selectedAssetPath: string | null;
    setSelectedAssetPath: (path: string | null) => void;
}

export interface EditorState
    extends UiPrefsSlice,
        PlaybackQuickCommandsSlice,
        ClipboardValidationAssetSlice,
        SelectionSlice,
        DockLayoutSlice {}

