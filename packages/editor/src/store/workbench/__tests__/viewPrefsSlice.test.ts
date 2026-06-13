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
        lastAudiosheetView: 'timeline',
        lastCharactersView: 'timeline',
        lastEngineConfigView: 'timeline',
        lastItemsView: 'timeline',
        lastMacrosView: 'timeline',
        lastManifestView: 'timeline',
        lastScriptView: 'timeline',
        lastSpritesheetView: 'timeline',
        openOrFocusTab: () => {},
        renameTabPath: () => {},
        setActiveTab: () => {},
        setLastAudiosheetView: () => {},
        setLastCharactersView: () => {},
        setLastEngineConfigView: () => {},
        setLastItemsView: () => {},
        setLastMacrosView: () => {},
        setLastManifestView: () => {},
        setLastScriptView: () => {},
        setLastSpritesheetView: () => {},
        tabs: [],
        updateTabContent: () => {},
    });

    harness.setState({
        ...createWorkbenchViewPrefsSlice(harness.set),
    });

    return harness;
}

describe('workbench view prefs slice', () => {
    it('initializes all view preferences to timeline', () => {
        const state = createViewPrefsState().get();

        expect(state.lastManifestView).toBe('timeline');
        expect(state.lastAudiosheetView).toBe('timeline');
        expect(state.lastCharactersView).toBe('timeline');
        expect(state.lastEngineConfigView).toBe('timeline');
        expect(state.lastItemsView).toBe('timeline');
        expect(state.lastMacrosView).toBe('timeline');
        expect(state.lastScriptView).toBe('timeline');
        expect(state.lastSpritesheetView).toBe('timeline');
    });

    it('updates each preference independently through setter functions', () => {
        const harness = createViewPrefsState();

        harness.get().setLastManifestView('json');
        harness.get().setLastAudiosheetView('json');
        harness.get().setLastCharactersView('json');
        harness.get().setLastEngineConfigView('json');
        harness.get().setLastItemsView('json');
        harness.get().setLastMacrosView('json');
        harness.get().setLastScriptView('json');
        harness.get().setLastSpritesheetView('json');

        expect(harness.get().lastManifestView).toBe('json');
        expect(harness.get().lastAudiosheetView).toBe('json');
        expect(harness.get().lastCharactersView).toBe('json');
        expect(harness.get().lastEngineConfigView).toBe('json');
        expect(harness.get().lastItemsView).toBe('json');
        expect(harness.get().lastMacrosView).toBe('json');
        expect(harness.get().lastScriptView).toBe('json');
        expect(harness.get().lastSpritesheetView).toBe('json');
    });
});

