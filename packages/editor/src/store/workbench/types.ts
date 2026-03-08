export type ScriptViewMode = 'timeline' | 'json';

export type WorkbenchResourceKind =
    | 'script'
    | 'macros'
    | 'asset'
    | 'manifest'
    | 'json'
    | 'text'
    | 'unknown';

export type WorkbenchTab = {
    id: string;
    kind: WorkbenchResourceKind;
    path: string;
    title: string;
    dirty?: boolean;

    preferredView?: ScriptViewMode;
    assetPath?: string;
    textContent?: string;
};

export type WorkbenchSet = (
    partial: Record<string, any> | ((state: Record<string, any>) => Record<string, any>)
) => void;

export type WorkbenchGet = () => Record<string, any>;

export interface WorkbenchTabsSlice {
    tabs: WorkbenchTab[];
    activeTabId: string | null;
    activeTab: () => WorkbenchTab | null;
    openOrFocusTab: (tab: WorkbenchTab) => void;
    closeTab: (tabId: string) => void;
    setActiveTab: (tabId: string | null) => void;
    clearTabs: () => void;
    closeOthers: (tabId: string) => void;
    closeToRight: (tabId: string) => void;
}

export interface WorkbenchViewPrefsSlice {
    lastScriptView: ScriptViewMode;
    lastMacrosView: ScriptViewMode;
    setLastScriptView: (view: ScriptViewMode) => void;
    setLastMacrosView: (view: ScriptViewMode) => void;
}

export interface WorkbenchState extends WorkbenchTabsSlice, WorkbenchViewPrefsSlice {}

