import type { WorkbenchGet, WorkbenchSet, WorkbenchTab, WorkbenchTabsSlice } from '../types';

export function createWorkbenchTabsSlice(set: WorkbenchSet, get: WorkbenchGet): WorkbenchTabsSlice {
    return {
        tabs: [],
        activeTab: () => {
            const s = get();
            return s.tabs.find((t: WorkbenchTab) => t.id === s.activeTabId) ?? null;
        },
        activeTabId: null,

        openOrFocusTab: (tab) =>
            set((state) => {
                const existing = state.tabs.find((t: WorkbenchTab) => t.id === tab.id);
                if (existing) return { activeTabId: existing.id };
                return { tabs: [...state.tabs, tab], activeTabId: tab.id };
            }),

        closeTab: (tabId) =>
            set((state) => {
                const idx = state.tabs.findIndex((t: WorkbenchTab) => t.id === tabId);
                if (idx < 0) return {};

                const nextTabs = state.tabs.filter((t: WorkbenchTab) => t.id !== tabId);
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
                const keep = state.tabs.find((t: WorkbenchTab) => t.id === tabId);
                if (!keep) return {};
                return { tabs: [keep], activeTabId: tabId };
            }),

        closeToRight: (tabId) =>
            set((state) => {
                const idx = state.tabs.findIndex((t: WorkbenchTab) => t.id === tabId);
                if (idx < 0) return {};
                const nextTabs = state.tabs.slice(0, idx + 1);
                const activeStillExists = nextTabs.some((t: WorkbenchTab) => t.id === state.activeTabId);
                return {
                    tabs: nextTabs,
                    activeTabId: activeStillExists ? state.activeTabId : tabId,
                };
            }),
    };
}

