import {
    executeWorkbenchOpenAction,
    getPreferredManifestView,
} from '../../store/actions/workbenchOpenActions';
import { makeTabId } from '../../store/useWorkbenchStore';
import { applyMacrosFile, applyScriptFile } from '../projectOpeners';
import { openMacrosTab, openScriptTab } from './tabOpeners';
import { basenameFromPath } from './pathHelpers';

import type { ForceView } from './contracts';
import type { JsonRoute } from './jsonRouting';

import { getPreferredViewForJsonResource, getViewActionForJsonResource } from './viewPrefs';

type HandleJsonRouteOptions = {
    contents: string;
    data: unknown;
    forceView?: ForceView;
    fullPath: string;
    isMacrosObject: (value: unknown) => boolean;
    route: JsonRoute;
};

export function handleJsonRoute(options: HandleJsonRouteOptions): void {
    const {
        contents,
        data,
        forceView,
        fullPath,
        isMacrosObject,
        route,
    } = options;

    if (route.kind === 'resource') {
        const preferredView = getPreferredViewForJsonResource(route.resourceKind, forceView);
        const viewAction = getViewActionForJsonResource(route.resourceKind);

        if (forceView) {
            executeWorkbenchOpenAction({ action: viewAction, view: forceView });
        }

        executeWorkbenchOpenAction({ action: 'openTab', tab: {
            id: makeTabId(route.resourceKind, fullPath),
            kind: route.resourceKind,
            path: fullPath,
            preferredView,
            textContent: contents,
            title: route.resourceKind === 'manifest' ? 'Project Settings' : basenameFromPath(fullPath),
        }});
        return;
    }

    if (route.kind === 'script') {
        if (!Array.isArray(data)) {
            throw new TypeError('Scene scripts must be JSON arrays.');
        }
        applyScriptFile(fullPath, data);
        openScriptTab(fullPath, forceView);
        return;
    }

    if (route.kind === 'macros') {
        if (!isMacrosObject(data)) {
            throw new TypeError('Macros file must be a JSON object of command arrays.');
        }
        applyMacrosFile(fullPath, data as Record<string, unknown>);
        openMacrosTab(fullPath, forceView);
        return;
    }

    const preferredView = route.tabKind === 'manifest' ? getPreferredManifestView(forceView) : undefined;
    if (route.tabKind === 'manifest' && forceView) {
        executeWorkbenchOpenAction({ action: 'setManifestView', view: forceView });
    }
    executeWorkbenchOpenAction({ action: 'openTab', tab: {
        id: makeTabId(route.tabKind, fullPath),
        kind: route.tabKind,
        path: fullPath,
        preferredView,
        textContent: contents,
        title: route.tabKind === 'manifest' ? 'Project Settings' : basenameFromPath(fullPath),
    }});
}


