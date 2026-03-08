import { create } from 'zustand';
import { createWorkbenchTabsSlice } from './workbench/slices/tabsSlice';
import { createWorkbenchViewPrefsSlice } from './workbench/slices/viewPrefsSlice';
import type { WorkbenchResourceKind, WorkbenchState } from './workbench/types';

export type { ScriptViewMode, WorkbenchResourceKind, WorkbenchTab } from './workbench/types';

function tabKey(kind: WorkbenchResourceKind, path: string) {
    return `${kind}::${path}`;
}

export const useWorkbenchStore = create<WorkbenchState>((set, get) => ({
    ...createWorkbenchTabsSlice(set, get),
    ...createWorkbenchViewPrefsSlice(set),
}));

export function makeTabId(kind: WorkbenchResourceKind, path: string) {
    return tabKey(kind, path);
}