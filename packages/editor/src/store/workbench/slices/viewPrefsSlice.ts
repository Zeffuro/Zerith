import type { WorkbenchSet, WorkbenchViewPrefsSlice } from '../types';

export function createWorkbenchViewPrefsSlice(set: WorkbenchSet): WorkbenchViewPrefsSlice {
    return {
        lastCharactersView: 'timeline',
        lastItemsView: 'timeline',
        lastMacrosView: 'timeline',
        lastManifestView: 'timeline',
        lastScriptView: 'timeline',
        setLastCharactersView: (view) => set({ lastCharactersView: view }),
        setLastItemsView: (view) => set({ lastItemsView: view }),
        setLastMacrosView: (view) => set({ lastMacrosView: view }),
        setLastManifestView: (view) => set({ lastManifestView: view }),
        setLastScriptView: (view) => set({ lastScriptView: view }),
    };
}

