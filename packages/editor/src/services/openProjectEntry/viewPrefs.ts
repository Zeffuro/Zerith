import type { ForceView, JsonResourceKind } from './contracts';

import {
    getPreferredCharactersView,
    getPreferredEngineConfigView,
    getPreferredItemsView,
    getPreferredManifestView,
} from '../../store/actions/workbenchOpenActions';

export function getPreferredViewForJsonResource(kind: JsonResourceKind, fallback?: ForceView) {
    if (kind === 'manifest') return getPreferredManifestView(fallback);
    if (kind === 'engineConfig') return getPreferredEngineConfigView(fallback);
    if (kind === 'items') return getPreferredItemsView(fallback);
    return getPreferredCharactersView(fallback);
}

export function getViewActionForJsonResource(kind: JsonResourceKind) {
    if (kind === 'manifest') return 'setManifestView' as const;
    if (kind === 'engineConfig') return 'setEngineConfigView' as const;
    if (kind === 'items') return 'setItemsView' as const;
    return 'setCharactersView' as const;
}

