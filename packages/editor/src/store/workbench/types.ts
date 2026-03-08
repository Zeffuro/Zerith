export type ScriptViewMode = 'json' | 'timeline';

export type WorkbenchGet = () => Record<string, any>;

export type WorkbenchResourceKind =
    | 'asset'
    | 'json'
    | 'macros'
    | 'manifest'
    | 'script'
    | 'text'
    | 'unknown';

export type WorkbenchSet = (
    partial: ((state: Record<string, any>) => Record<string, any>) | Record<string, any>
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
    activeTab: () => null | WorkbenchTab;
    activeTabId: null | string;
    clearTabs: () => void;
    closeOthers: (tabId: string) => void;
    closeTab: (tabId: string) => void;
    closeToRight: (tabId: string) => void;
    openOrFocusTab: (tab: WorkbenchTab) => void;
    setActiveTab: (tabId: null | string) => void;
    tabs: WorkbenchTab[];
}

export interface WorkbenchViewPrefsSlice {
    lastMacrosView: ScriptViewMode;
    lastScriptView: ScriptViewMode;
    setLastMacrosView: (view: ScriptViewMode) => void;
    setLastScriptView: (view: ScriptViewMode) => void;
}

