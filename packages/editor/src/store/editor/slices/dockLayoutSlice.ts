import type { DockLayoutSlice, EditorSet } from '../types';

import { createDefaultDockLayout, DOCK_LAYOUT_VERSION } from '../../../components/layout/dock/defaultDockLayout';

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

export function normalizeDockLayoutState(state: any) {
    const hasValidVersion = state?.dockLayoutVersion === DOCK_LAYOUT_VERSION;
    const hasLayout = !!state?.dockLayoutJson;

    if (hasValidVersion && hasLayout) {
        return {
            dockLayoutJson: state.dockLayoutJson,
            dockLayoutVersion: state.dockLayoutVersion,
        };
    }

    return {
        dockLayoutJson: createDefaultDockLayout(),
        dockLayoutVersion: DOCK_LAYOUT_VERSION,
    };
}

