import type { WorkbenchGet, WorkbenchSet, WorkbenchTab, WorkbenchTabsSlice } from '../types';

export function createWorkbenchTabsSlice(set: WorkbenchSet, get: WorkbenchGet): WorkbenchTabsSlice {
    return {
        activeTab: () => {
            const s = get();
            return s.tabs.find((t: WorkbenchTab) => t.id === s.activeTabId);
        },
        activeTabId: undefined,
        clearTabs: () => set({ activeTabId: undefined, tabs: [] }),

        closeOthers: (tabId) =>
            set((state) => {
                const keep = state.tabs.find((t: WorkbenchTab) => t.id === tabId);
                if (!keep) return {};
                return { activeTabId: tabId, tabs: [keep] };
            }),

        closeTab: (tabId) =>
            set((state) => {
                const index = state.tabs.findIndex((t: WorkbenchTab) => t.id === tabId);
                if (index === -1) return {};

                const nextTabs = state.tabs.filter((t: WorkbenchTab) => t.id !== tabId);
                let nextActive = state.activeTabId;

                if (state.activeTabId === tabId) {
                    nextActive = nextTabs.length === 0 ? undefined : nextTabs[Math.max(0, index - 1)]?.id ?? nextTabs[0].id;
                }

                return { activeTabId: nextActive, tabs: nextTabs };
            }),

        closeToRight: (tabId) =>
            set((state) => {
                const index = state.tabs.findIndex((t: WorkbenchTab) => t.id === tabId);
                if (index === -1) return {};
                const nextTabs = state.tabs.slice(0, index + 1);
                const activeStillExists = nextTabs.some((t: WorkbenchTab) => t.id === state.activeTabId);
                return {
                    activeTabId: activeStillExists ? state.activeTabId : tabId,
                    tabs: nextTabs,
                };
            }),
        openOrFocusTab: (tab) =>
            set((state) => {
                const existing = state.tabs.find((t: WorkbenchTab) => t.id === tab.id);
                if (existing) return { activeTabId: existing.id };
                return { activeTabId: tab.id, tabs: [...state.tabs, tab] };
            }),

        setActiveTab: (tabId) => set({ activeTabId: tabId }),

        tabs: [],
    };
}
