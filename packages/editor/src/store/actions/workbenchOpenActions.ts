import type { ScriptViewMode, WorkbenchTab } from '../useWorkbenchStore';
import { useWorkbenchStore } from '../useWorkbenchStore';

export type WorkbenchOpenAction = 'openTab' | 'setScriptView' | 'setMacrosView';

export type ExecuteWorkbenchOpenActionOptions =
    | { action: 'openTab'; tab: WorkbenchTab }
    | { action: 'setScriptView'; view: ScriptViewMode }
    | { action: 'setMacrosView'; view: ScriptViewMode };

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

export function getPreferredScriptView(fallback?: ScriptViewMode): ScriptViewMode {
    const workbench = useWorkbenchStore.getState();
    return fallback ?? workbench.lastScriptView;
}

export function getPreferredMacrosView(fallback?: ScriptViewMode): ScriptViewMode {
    const workbench = useWorkbenchStore.getState();
    return fallback ?? workbench.lastMacrosView;
}

