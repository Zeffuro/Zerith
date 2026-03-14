import type { WorkbenchGet, WorkbenchSet, WorkbenchTab, WorkbenchTabsSlice } from '../types';

import { useProjectStore } from '../../storeBootstrap';

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
                if (existing) {
                    return {
                        activeTabId: existing.id,
                        tabs: state.tabs.map((candidate) => (candidate.id === tab.id ? { ...candidate, ...tab } : candidate)),
                    };
                }
                return { activeTabId: tab.id, tabs: [...state.tabs, tab] };
            }),

        renameTabPath: (nextPath, oldPath) =>
            set((state) => {
                const previousActive = state.tabs.find((tab) => tab.id === state.activeTabId);
                let changed = false;
                const nextTabs = state.tabs.map((tab) => {
                    if (tab.path !== oldPath) return tab;
                    changed = true;
                    return {
                        ...tab,
                        id: tabKey(tab.kind, nextPath),
                        path: nextPath,
                        title: basename(nextPath),
                    };
                });
                if (!changed) return {};

                const nextActive =
                    previousActive?.path === oldPath
                        ? tabKey(previousActive.kind, nextPath)
                        : state.activeTabId;

                return { activeTabId: nextActive, tabs: nextTabs };
            }),

        setActiveTab: (tabId) => set({ activeTabId: tabId }),

        tabs: [],

        updateTabContent: (tabId, textContent, options) =>
            set((state) => {
                const markDirty = options?.markDirty !== false;
                const targetTab = state.tabs.find((tab) => tab.id === tabId);
                if (targetTab?.path) {
                    if (markDirty) {
                        useProjectStore.getState().markFileDirty(targetTab.path);
                    } else {
                        useProjectStore.getState().clearFileDirty(targetTab.path);
                    }
                }

                return {
                    tabs: state.tabs.map((tab) => (
                        tab.id === tabId
                            ? { ...tab, dirty: markDirty, textContent }
                            : tab
                    )),
                };
            }),
    };
}

function basename(path: string) {
    return path.split(/[\\/]/).pop() || path;
}

function tabKey(kind: WorkbenchTab['kind'], path: string) {
    return `${kind}::${path}`;
}

