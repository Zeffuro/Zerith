import type { NonMacroEditorCommandType } from '../../plugins/types';
import type { ScriptPath } from '../../utils/scriptPathUtils';

export interface ClipboardValidationAssetSlice {
    clearValidationErrors: () => void;
    clipboardNode: any | null;
    selectedAssetPath: null | string;
    setClipboardNode: (node: any | null) => void;
    setSelectedAssetPath: (path: null | string) => void;
    setValidationErrors: (errors: Record<string, string[]>) => void;
    validationErrors: Record<string, string[]>;
}

export type DeleteRequestSource = 'click' | 'keyboard';

export interface DockLayoutSlice {
    dockLayoutJson: any;
    dockLayoutVersion: number;
    resetDockLayout: () => void;
    setDockLayoutJson: (json: any) => void;
}

export type EditorSet = (
    partial: ((state: Record<string, any>) => Record<string, any>) | Record<string, any>
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
} | null;

export type PendingDeleteRequest = {
    paths: ScriptPath[];
    source: DeleteRequestSource;
} | null;

export interface PlaybackQuickCommandsSlice {
    moveQuickCommandType: (type: NonMacroEditorCommandType, direction: 'left' | 'right') => void;
    playFromIndex: null | number;
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
    selectionAnchorPath: null | ScriptPath;
    setSelectedNodePaths: (paths: ScriptPath[]) => void;
    setSelectionAnchorPath: (path: null | ScriptPath) => void;
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

