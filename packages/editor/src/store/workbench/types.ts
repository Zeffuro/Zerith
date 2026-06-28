export type ScriptViewMode = 'json' | 'timeline';

export type WorkbenchGet = () => WorkbenchState;

export type WorkbenchResourceKind =
    | 'asset'
    | 'audiosheet'
    | 'characters'
    | 'engineConfig'
    | 'gitDiff'
    | 'items'
    | 'json'
    | 'localization'
    | 'macros'
    | 'manifest'
    | 'script'
    | 'spritesheet'
    | 'text'
    | 'unknown';

export type WorkbenchSet = (
    partial: ((state: WorkbenchState) => Partial<WorkbenchState> | WorkbenchState) | Partial<WorkbenchState> | WorkbenchState,
    replace?: false  
) => void;

export interface WorkbenchState extends WorkbenchTabsSlice, WorkbenchViewPrefsSlice {}

export type WorkbenchTab = {
    assetPath?: string;
    dirty?: boolean;
    gitDiffFilePath?: string;
    gitDiffRepositoryRoot?: string;
    id: string;
    jsonSelectionPath?: string[];
    kind: WorkbenchResourceKind;
    localizationFilter?: string;
    path: string;

    preferredView?: ScriptViewMode;
    textContent?: string;
    title: string;
};

export interface WorkbenchTabsSlice {
    activeTab: () => undefined | WorkbenchTab;
    activeTabId: string | undefined;
    clearTabs: () => void;
    closeOthers: (tabId: string) => void;
    closeTab: (tabId: string) => void;
    closeToRight: (tabId: string) => void;
    openOrFocusTab: (tab: WorkbenchTab) => void;
    renameTabPath: (nextPath: string, oldPath: string) => void;
    setActiveTab: (tabId: string | undefined) => void;
    tabs: WorkbenchTab[];
    updateTabContent: (
        tabId: string,
        textContent: string,
        options?: { markDirty?: boolean },
    ) => void;
}

export interface WorkbenchViewPrefsSlice {
    lastAudiosheetView: ScriptViewMode;
    lastCharactersView: ScriptViewMode;
    lastEngineConfigView: ScriptViewMode;
    lastItemsView: ScriptViewMode;
    lastMacrosView: ScriptViewMode;
    lastManifestView: ScriptViewMode;
    lastScriptView: ScriptViewMode;
    lastSpritesheetView: ScriptViewMode;
    setLastAudiosheetView: (view: ScriptViewMode) => void;
    setLastCharactersView: (view: ScriptViewMode) => void;
    setLastEngineConfigView: (view: ScriptViewMode) => void;
    setLastItemsView: (view: ScriptViewMode) => void;
    setLastMacrosView: (view: ScriptViewMode) => void;
    setLastManifestView: (view: ScriptViewMode) => void;
    setLastScriptView: (view: ScriptViewMode) => void;
    setLastSpritesheetView: (view: ScriptViewMode) => void;
}
