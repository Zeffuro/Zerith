import { create } from 'zustand';

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

type WorkbenchState = {
    tabs: WorkbenchTab[];
    activeTab: () => WorkbenchTab | null;
    activeTabId: string | null;

    lastScriptView: ScriptViewMode;
    lastMacrosView: ScriptViewMode;

    setLastScriptView: (view: ScriptViewMode) => void;
    setLastMacrosView: (view: ScriptViewMode) => void;

    openOrFocusTab: (tab: WorkbenchTab) => void;
    closeTab: (tabId: string) => void;
    setActiveTab: (tabId: string | null) => void;
    clearTabs: () => void;
    closeOthers: (tabId: string) => void;
    closeToRight: (tabId: string) => void;
};

function tabKey(kind: WorkbenchResourceKind, path: string) {
    return `${kind}::${path}`;
}

export const useWorkbenchStore = create<WorkbenchState>((set, get) => ({
    tabs: [],
    activeTab: () => {
        const s = get();
        return s.tabs.find((t) => t.id === s.activeTabId) ?? null;
    },
    activeTabId: null,

    lastScriptView: 'timeline',
    lastMacrosView: 'timeline',

    setLastScriptView: (view) => set({ lastScriptView: view }),
    setLastMacrosView: (view) => set({ lastMacrosView: view }),

    openOrFocusTab: (tab) =>
        set((state) => {
            const existing = state.tabs.find((t) => t.id === tab.id);
            if (existing) return { activeTabId: existing.id };
            return { tabs: [...state.tabs, tab], activeTabId: tab.id };
        }),

    closeTab: (tabId) =>
        set((state) => {
            const idx = state.tabs.findIndex((t) => t.id === tabId);
            if (idx < 0) return {};

            const nextTabs = state.tabs.filter((t) => t.id !== tabId);
            let nextActive = state.activeTabId;

            if (state.activeTabId === tabId) {
                if (nextTabs.length === 0) nextActive = null;
                else nextActive = nextTabs[Math.max(0, idx - 1)]?.id ?? nextTabs[0].id;
            }

            return { tabs: nextTabs, activeTabId: nextActive };
        }),

    setActiveTab: (tabId) => set({ activeTabId: tabId }),
    clearTabs: () => set({ tabs: [], activeTabId: null }),

    closeOthers: (tabId) =>
        set((state) => {
            const keep = state.tabs.find((t) => t.id === tabId);
            if (!keep) return {};
            return { tabs: [keep], activeTabId: tabId };
        }),

    closeToRight: (tabId) =>
        set((state) => {
            const idx = state.tabs.findIndex((t) => t.id === tabId);
            if (idx < 0) return {};
            const nextTabs = state.tabs.slice(0, idx + 1);
            const activeStillExists = nextTabs.some((t) => t.id === state.activeTabId);
            return {
                tabs: nextTabs,
                activeTabId: activeStillExists ? state.activeTabId : tabId,
            };
        }),
}));

export function makeTabId(kind: WorkbenchResourceKind, path: string) {
    return tabKey(kind, path);
}