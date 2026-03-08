import type { WorkbenchSet, WorkbenchViewPrefsSlice } from '../types';

export function createWorkbenchViewPrefsSlice(set: WorkbenchSet): WorkbenchViewPrefsSlice {
    return {
        lastMacrosView: 'timeline',
        lastScriptView: 'timeline',
        setLastMacrosView: (view) => set({ lastMacrosView: view }),
        setLastScriptView: (view) => set({ lastScriptView: view }),
    };
}

