import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { WorkbenchState, WorkbenchTab } from '../types';

import { createSliceHarness } from '../../../test-utils/createSliceHarness';

const projectStoreMocks = vi.hoisted(() => ({
    clearFileDirty: vi.fn(),
    markFileDirty: vi.fn(),
}));

vi.mock('../../storeBootstrap', () => ({
    useProjectStore: {
        getState: () => projectStoreMocks,
    },
}));

import { createWorkbenchTabsSlice } from '../slices/tabsSlice';

type TabsTestState = WorkbenchState;

function createTabsState() {
    const harness = createSliceHarness<TabsTestState>({
        activeTab: () => void 0,
        activeTabId: undefined,
        clearTabs: () => {},
        closeOthers: () => {},
        closeTab: () => {},
        closeToRight: () => {},
        lastCharactersView: 'timeline',
        lastItemsView: 'timeline',
        lastMacrosView: 'timeline',
        lastManifestView: 'timeline',
        lastScriptView: 'timeline',
        openOrFocusTab: () => {},
        renameTabPath: () => {},
        setActiveTab: () => {},
        setLastCharactersView: () => {},
        setLastItemsView: () => {},
        setLastMacrosView: () => {},
        setLastManifestView: () => {},
        setLastScriptView: () => {},
        tabs: [],
        updateTabContent: () => {},
    });

    harness.setState({
        ...createWorkbenchTabsSlice(harness.set as never, harness.get as never),
    });

    return harness;
}

function tab(kind: WorkbenchTab['kind'], path: string): WorkbenchTab {
    return {
        id: `${kind}::${path}`,
        kind,
        path,
        title: path.split('/').at(-1) ?? path,
    };
}

describe('workbench tabs slice', () => {
    beforeEach(() => {
        projectStoreMocks.clearFileDirty.mockReset();
        projectStoreMocks.markFileDirty.mockReset();
    });

    it('openOrFocusTab opens and focuses tabs, and merges updates for existing ids', () => {
        const harness = createTabsState();
        const sceneTab = tab('script', '/project/scripts/intro.json');

        harness.get().openOrFocusTab(sceneTab);
        expect(harness.get().activeTabId).toBe(sceneTab.id);
        expect(harness.get().tabs).toHaveLength(1);

        harness.get().openOrFocusTab({ ...sceneTab, title: 'Intro Scene' });
        expect(harness.get().tabs).toHaveLength(1);
        expect(harness.get().tabs[0].title).toBe('Intro Scene');
        expect(harness.get().activeTab()?.id).toBe(sceneTab.id);
    });

    it('closeTab, closeOthers, closeToRight and clearTabs maintain active tab correctly', () => {
        const harness = createTabsState();
        const t1 = tab('script', '/project/scripts/intro.json');
        const t2 = tab('script', '/project/scripts/day2.json');
        const t3 = tab('json', '/project/data/items.json');

        harness.setState({
            activeTabId: t2.id,
            tabs: [t1, t2, t3],
        });

        harness.get().closeTab(t2.id);
        expect(harness.get().tabs.map((item) => item.id)).toEqual([t1.id, t3.id]);
        expect(harness.get().activeTabId).toBe(t1.id);

        harness.get().closeToRight(t1.id);
        expect(harness.get().tabs.map((item) => item.id)).toEqual([t1.id]);
        expect(harness.get().activeTabId).toBe(t1.id);

        harness.setState({ tabs: [t1, t2, t3] });
        harness.get().closeOthers(t3.id);
        expect(harness.get().tabs.map((item) => item.id)).toEqual([t3.id]);
        expect(harness.get().activeTabId).toBe(t3.id);

        harness.get().clearTabs();
        expect(harness.get().tabs).toEqual([]);
        expect(harness.get().activeTabId).toBeUndefined();
    });

    it('renameTabPath updates tab id/path/title and tracks active renamed tab', () => {
        const harness = createTabsState();
        const sourcePath = '/project/scripts/intro.json';
        const nextPath = '/project/scripts/opening.json';
        const sourceTab = tab('script', sourcePath);

        harness.setState({
            activeTabId: sourceTab.id,
            tabs: [sourceTab],
        });

        harness.get().renameTabPath(nextPath, sourcePath);

        expect(harness.get().activeTabId).toBe(`script::${nextPath}`);
        expect(harness.get().tabs[0]).toMatchObject({
            id: `script::${nextPath}`,
            path: nextPath,
            title: 'opening.json',
        });
    });

    it('updateTabContent marks and clears dirty files through project store hooks', () => {
        const harness = createTabsState();
        const sceneTab = tab('script', '/project/scripts/intro.json');

        harness.setState({ tabs: [sceneTab] });

        harness.get().updateTabContent(sceneTab.id, 'new content');
        expect(projectStoreMocks.markFileDirty).toHaveBeenCalledWith('/project/scripts/intro.json');
        expect(harness.get().tabs[0]).toMatchObject({ dirty: true, textContent: 'new content' });

        harness.get().updateTabContent(sceneTab.id, 'saved content', { markDirty: false });
        expect(projectStoreMocks.clearFileDirty).toHaveBeenCalledWith('/project/scripts/intro.json');
        expect(harness.get().tabs[0]).toMatchObject({ dirty: false, textContent: 'saved content' });
    });
});

