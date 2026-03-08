import { createDefaultDockLayout, DOCK_LAYOUT_VERSION } from '../../../components/layout/dock/defaultDockLayout';
import type { DockLayoutSlice, EditorSet } from '../types';

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

export function createDockLayoutSlice(set: EditorSet): DockLayoutSlice {
    return {
        ...normalizeDockLayoutState({}),
        setDockLayoutJson: (json) => set({ dockLayoutJson: json }),
        resetDockLayout: () =>
            set({
                dockLayoutJson: createDefaultDockLayout(),
                dockLayoutVersion: DOCK_LAYOUT_VERSION,
            }),
    };
}

