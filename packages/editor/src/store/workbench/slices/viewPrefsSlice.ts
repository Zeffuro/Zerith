import type { WorkbenchSet, WorkbenchViewPrefsSlice } from '../types';

export function createWorkbenchViewPrefsSlice(set: WorkbenchSet): WorkbenchViewPrefsSlice {
    return {
        lastScriptView: 'timeline',
        lastMacrosView: 'timeline',
        setLastScriptView: (view) => set({ lastScriptView: view }),
        setLastMacrosView: (view) => set({ lastMacrosView: view }),
    };
}

