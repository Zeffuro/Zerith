import type { DockLayoutSlice, EditorSet } from '../types';

import { createDefaultDockLayout, DOCK_LAYOUT_VERSION } from '../../../components/layout/dock/defaultDockLayout';
import { isRecord } from '../../../utils/typeGuards';

export function createDockLayoutSlice(set: EditorSet): DockLayoutSlice {
    return {
        ...normalizeDockLayoutState({}),
        resetDockLayout: () =>
            set({
                dockLayoutJson: createDefaultDockLayout(),
                dockLayoutVersion: DOCK_LAYOUT_VERSION,
            }),
        setDockLayoutJson: (json) => set({ dockLayoutJson: json }),
    };
}

export function normalizeDockLayoutState(
    state: unknown
): Pick<DockLayoutSlice, 'dockLayoutJson' | 'dockLayoutVersion'> {
    if (!isRecord(state)) {
        return {
            dockLayoutJson: createDefaultDockLayout(),
            dockLayoutVersion: DOCK_LAYOUT_VERSION,
        };
    }

    const persistedVersion = typeof state.dockLayoutVersion === 'number' ? state.dockLayoutVersion : undefined;
    const hasValidVersion = persistedVersion === DOCK_LAYOUT_VERSION;
    const hasLayout = isLikelyDockLayoutJson(state.dockLayoutJson);

    if (hasValidVersion && hasLayout) {
        return {
            dockLayoutJson: state.dockLayoutJson,
            dockLayoutVersion: persistedVersion,
        };
    }

    return {
        dockLayoutJson: createDefaultDockLayout(),
        dockLayoutVersion: DOCK_LAYOUT_VERSION,
    };
}

function isLikelyDockLayoutJson(value: unknown): boolean {
    if (!isRecord(value)) return false;
    const hasGlobal = isRecord(value.global);
    const hasLayout = isRecord(value.layout);
    return hasGlobal && hasLayout;
}


