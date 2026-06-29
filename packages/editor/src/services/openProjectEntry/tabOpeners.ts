import type { ScriptPath } from '../../utils/scriptPathUtilities';
import type { ForceView } from './contracts';

import {
    executeWorkbenchOpenAction,
    getPreferredMacrosView,
    getPreferredScriptView,
} from '../../store/actions/workbenchOpenActions';
import { makeTabId } from '../../store/useWorkbenchStore';
import { basenameFromPath } from './pathHelpers';

export function openMacrosTab(fullPath: string, forceView?: ForceView, jsonSelectionPath?: ScriptPath) {
    const preferred = getPreferredMacrosView(forceView);
    if (forceView) executeWorkbenchOpenAction({ action: 'setMacrosView', view: forceView });

    executeWorkbenchOpenAction({ action: 'openTab', tab: {
        id: makeTabId('macros', fullPath),
        ...(jsonSelectionPath ? { jsonSelectionPath } : {}),
        kind: 'macros',
        path: fullPath,
        preferredView: preferred,
        title: basenameFromPath(fullPath),
    }});
}

export function openScriptTab(fullPath: string, forceView?: ForceView, jsonSelectionPath?: ScriptPath) {
    const preferred = getPreferredScriptView(forceView);
    if (forceView) executeWorkbenchOpenAction({ action: 'setScriptView', view: forceView });

    executeWorkbenchOpenAction({ action: 'openTab', tab: {
        id: makeTabId('script', fullPath),
        ...(jsonSelectionPath ? { jsonSelectionPath } : {}),
        kind: 'script',
        path: fullPath,
        preferredView: preferred,
        title: basenameFromPath(fullPath),
    }});
}

