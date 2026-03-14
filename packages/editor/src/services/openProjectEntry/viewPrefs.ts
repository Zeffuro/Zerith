import type { ForceView, JsonResourceKind } from './contracts';

import {
    getPreferredCharactersView,
    getPreferredItemsView,
    getPreferredManifestView,
} from '../../store/actions/workbenchOpenActions';

export function getPreferredViewForJsonResource(kind: JsonResourceKind, fallback?: ForceView) {
    if (kind === 'manifest') return getPreferredManifestView(fallback);
    if (kind === 'items') return getPreferredItemsView(fallback);
    return getPreferredCharactersView(fallback);
}

export function getViewActionForJsonResource(kind: JsonResourceKind) {
    if (kind === 'manifest') return 'setManifestView' as const;
    if (kind === 'items') return 'setItemsView' as const;
    return 'setCharactersView' as const;
}

