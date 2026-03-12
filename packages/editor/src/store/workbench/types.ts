export type ScriptViewMode = 'json' | 'timeline';

export type WorkbenchGet = () => WorkbenchState;

export type WorkbenchResourceKind =
    | 'asset'
    | 'characters'
    | 'items'
    | 'json'
    | 'macros'
    | 'manifest'
    | 'script'
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
    id: string;
    kind: WorkbenchResourceKind;
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
    updateTabContent: (tabId: string, textContent: string) => void;
}

export interface WorkbenchViewPrefsSlice {
    lastCharactersView: ScriptViewMode;
    lastItemsView: ScriptViewMode;
    lastMacrosView: ScriptViewMode;
    lastManifestView: ScriptViewMode;
    lastScriptView: ScriptViewMode;
    setLastCharactersView: (view: ScriptViewMode) => void;
    setLastItemsView: (view: ScriptViewMode) => void;
    setLastMacrosView: (view: ScriptViewMode) => void;
    setLastManifestView: (view: ScriptViewMode) => void;
    setLastScriptView: (view: ScriptViewMode) => void;
}
