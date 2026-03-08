import type { ScriptViewMode, WorkbenchTab } from '../useWorkbenchStore';

import { useWorkbenchStore } from '../useWorkbenchStore';

export type ExecuteWorkbenchOpenActionOptions =
    | { action: 'openTab'; tab: WorkbenchTab }
    | { action: 'setMacrosView'; view: ScriptViewMode }
    | { action: 'setScriptView'; view: ScriptViewMode };

export type WorkbenchOpenAction = 'openTab' | 'setMacrosView' | 'setScriptView';

export function executeWorkbenchOpenAction(options: ExecuteWorkbenchOpenActionOptions): void {
    const workbench = useWorkbenchStore.getState();

    if (options.action === 'openTab') {
        workbench.openOrFocusTab(options.tab);
        return;
    }

    if (options.action === 'setScriptView') {
        workbench.setLastScriptView(options.view);
        return;
    }

    workbench.setLastMacrosView(options.view);
}

export function getPreferredMacrosView(fallback?: ScriptViewMode): ScriptViewMode {
    const workbench = useWorkbenchStore.getState();
    return fallback ?? workbench.lastMacrosView;
}

export function getPreferredScriptView(fallback?: ScriptViewMode): ScriptViewMode {
    const workbench = useWorkbenchStore.getState();
    return fallback ?? workbench.lastScriptView;
}

