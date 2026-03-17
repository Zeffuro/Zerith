import type { WorkbenchSet, WorkbenchViewPrefsSlice } from '../types';

export function createWorkbenchViewPrefsSlice(set: WorkbenchSet): WorkbenchViewPrefsSlice {
    return {
        lastAudiosheetView: 'timeline',
        lastCharactersView: 'timeline',
        lastEngineConfigView: 'timeline',
        lastItemsView: 'timeline',
        lastMacrosView: 'timeline',
        lastManifestView: 'timeline',
        lastScriptView: 'timeline',
        lastSpritesheetView: 'timeline',
        setLastAudiosheetView: (view) => set({ lastAudiosheetView: view }),
        setLastCharactersView: (view) => set({ lastCharactersView: view }),
        setLastEngineConfigView: (view) => set({ lastEngineConfigView: view }),
        setLastItemsView: (view) => set({ lastItemsView: view }),
        setLastMacrosView: (view) => set({ lastMacrosView: view }),
        setLastManifestView: (view) => set({ lastManifestView: view }),
        setLastScriptView: (view) => set({ lastScriptView: view }),
        setLastSpritesheetView: (view) => set({ lastSpritesheetView: view }),
    };
}

