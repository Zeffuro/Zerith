import {
    executeWorkbenchOpenAction,
    getPreferredMacrosView,
    getPreferredScriptView,
} from '../../store/actions/workbenchOpenActions';
import { makeTabId } from '../../store/useWorkbenchStore';
import { basenameFromPath } from './pathHelpers';

import type { ForceView } from './contracts';

export function openScriptTab(fullPath: string, forceView?: ForceView) {
    const preferred = getPreferredScriptView(forceView);
    if (forceView) executeWorkbenchOpenAction({ action: 'setScriptView', view: forceView });

    executeWorkbenchOpenAction({ action: 'openTab', tab: {
        id: makeTabId('script', fullPath),
        kind: 'script',
        path: fullPath,
        preferredView: preferred,
        title: basenameFromPath(fullPath),
    }});
}

export function openMacrosTab(fullPath: string, forceView?: ForceView) {
    const preferred = getPreferredMacrosView(forceView);
    if (forceView) executeWorkbenchOpenAction({ action: 'setMacrosView', view: forceView });

    executeWorkbenchOpenAction({ action: 'openTab', tab: {
        id: makeTabId('macros', fullPath),
        kind: 'macros',
        path: fullPath,
        preferredView: preferred,
        title: basenameFromPath(fullPath),
    }});
}

