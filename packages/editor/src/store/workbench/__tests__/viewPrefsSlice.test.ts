import { describe, expect, it } from 'vitest';

import type { WorkbenchState } from '../types';

import { createSliceHarness } from '../../../test-utils/createSliceHarness';
import { createWorkbenchViewPrefsSlice } from '../slices/viewPrefsSlice';

function createViewPrefsState() {
    const harness = createSliceHarness<WorkbenchState>({
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
        ...createWorkbenchViewPrefsSlice(harness.set as never),
    });

    return harness;
}

describe('workbench view prefs slice', () => {
    it('initializes all view preferences to timeline', () => {
        const state = createViewPrefsState().get();

        expect(state.lastManifestView).toBe('timeline');
        expect(state.lastCharactersView).toBe('timeline');
        expect(state.lastItemsView).toBe('timeline');
        expect(state.lastMacrosView).toBe('timeline');
        expect(state.lastScriptView).toBe('timeline');
    });

    it('updates each preference independently through setter functions', () => {
        const harness = createViewPrefsState();

        harness.get().setLastManifestView('json');
        harness.get().setLastCharactersView('json');
        harness.get().setLastItemsView('json');
        harness.get().setLastMacrosView('json');
        harness.get().setLastScriptView('json');

        expect(harness.get().lastManifestView).toBe('json');
        expect(harness.get().lastCharactersView).toBe('json');
        expect(harness.get().lastItemsView).toBe('json');
        expect(harness.get().lastMacrosView).toBe('json');
        expect(harness.get().lastScriptView).toBe('json');
    });
});

