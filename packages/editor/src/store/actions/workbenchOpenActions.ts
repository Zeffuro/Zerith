import type { ScriptViewMode, WorkbenchTab } from '../useWorkbenchStore';

import { useWorkbenchStore } from '../useWorkbenchStore';

export type ExecuteWorkbenchOpenActionOptions =
    | { action: 'openTab'; tab: WorkbenchTab }
    | { action: 'setCharactersView'; view: ScriptViewMode }
    | { action: 'setEngineConfigView'; view: ScriptViewMode }
    | { action: 'setItemsView'; view: ScriptViewMode }
    | { action: 'setMacrosView'; view: ScriptViewMode }
    | { action: 'setManifestView'; view: ScriptViewMode }
    | { action: 'setScriptView'; view: ScriptViewMode };

export type WorkbenchOpenAction =
    | 'openTab'
    | 'setCharactersView'
    | 'setEngineConfigView'
    | 'setItemsView'
    | 'setMacrosView'
    | 'setManifestView'
    | 'setScriptView';

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

    if (options.action === 'setManifestView') {
        workbench.setLastManifestView(options.view);
        return;
    }

    if (options.action === 'setEngineConfigView') {
        workbench.setLastEngineConfigView(options.view);
        return;
    }

    if (options.action === 'setMacrosView') {
        workbench.setLastMacrosView(options.view);
        return;
    }

    if (options.action === 'setItemsView') {
        workbench.setLastItemsView(options.view);
        return;
    }

    workbench.setLastCharactersView(options.view);
}

export function getPreferredCharactersView(fallback?: ScriptViewMode): ScriptViewMode {
    const workbench = useWorkbenchStore.getState();
    return fallback ?? workbench.lastCharactersView;
}

export function getPreferredItemsView(fallback?: ScriptViewMode): ScriptViewMode {
    const workbench = useWorkbenchStore.getState();
    return fallback ?? workbench.lastItemsView;
}

export function getPreferredEngineConfigView(fallback?: ScriptViewMode): ScriptViewMode {
    const workbench = useWorkbenchStore.getState();
    return fallback ?? workbench.lastEngineConfigView;
}

export function getPreferredMacrosView(fallback?: ScriptViewMode): ScriptViewMode {
    const workbench = useWorkbenchStore.getState();
    return fallback ?? workbench.lastMacrosView;
}

export function getPreferredManifestView(fallback?: ScriptViewMode): ScriptViewMode {
    const workbench = useWorkbenchStore.getState();
    return fallback ?? workbench.lastManifestView;
}

export function getPreferredScriptView(fallback?: ScriptViewMode): ScriptViewMode {
    const workbench = useWorkbenchStore.getState();
    return fallback ?? workbench.lastScriptView;
}
