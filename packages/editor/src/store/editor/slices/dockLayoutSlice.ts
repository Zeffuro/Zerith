import type { DockLayoutSlice, EditorSet } from '../types';

import { createDefaultDockLayout, DOCK_LAYOUT_VERSION, normalizeDockLayoutJsonForFlexLayout } from '../../../components/layout/dock/defaultDockLayout';
import { isRecord } from '../../../utils/typeGuards';

export function createDockLayoutSlice(set: EditorSet): DockLayoutSlice {
    return {
        ...normalizeDockLayoutState({}),
        captureDockLayoutJson: () => {
            let capturedJson: unknown;
            set((state) => {
                capturedJson = state.getDockLayoutJsonSnapshot?.() ?? state.dockLayoutJson;
                return {};
            });
            return normalizeDockLayoutJson(capturedJson).dockLayoutJson;
        },
        getDockLayoutJsonSnapshot: undefined,
        registerDockLayoutJsonSnapshotProvider: (provider) => set({ getDockLayoutJsonSnapshot: provider }),
        resetDockLayout: () => set(normalizeDockLayoutJson(createDefaultDockLayout())),
        setDockLayoutJson: (json) => set(normalizeDockLayoutJson(json)),
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
    const normalizedLayout = normalizeDockLayoutJsonForFlexLayout(state.dockLayoutJson);

    if (hasValidVersion && normalizedLayout) {
        return {
            dockLayoutJson: normalizedLayout,
            dockLayoutVersion: persistedVersion,
        };
    }

    return normalizeDockLayoutJson();
}

function normalizeDockLayoutJson(json?: unknown): Pick<DockLayoutSlice, 'dockLayoutJson' | 'dockLayoutVersion'> {
    const normalizedLayout = normalizeDockLayoutJsonForFlexLayout(json);
    return {
        dockLayoutJson: normalizedLayout ?? createDefaultDockLayout(),
        dockLayoutVersion: DOCK_LAYOUT_VERSION,
    };
}


