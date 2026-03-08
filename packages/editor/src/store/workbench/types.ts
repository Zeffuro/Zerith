export type ScriptViewMode = 'json' | 'timeline';

export type WorkbenchGet = () => WorkbenchState;

export type WorkbenchResourceKind =
    | 'asset'
    | 'json'
    | 'macros'
    | 'manifest'
    | 'script'
    | 'text'
    | 'unknown';

export type WorkbenchSet = (
    partial: ((state: WorkbenchState) => Partial<WorkbenchState> | WorkbenchState) | Partial<WorkbenchState> | WorkbenchState,
    replace?: boolean
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
    setActiveTab: (tabId: string | undefined) => void;
    tabs: WorkbenchTab[];
}

export interface WorkbenchViewPrefsSlice {
    lastMacrosView: ScriptViewMode;
    lastScriptView: ScriptViewMode;
    setLastMacrosView: (view: ScriptViewMode) => void;
    setLastScriptView: (view: ScriptViewMode) => void;
}
