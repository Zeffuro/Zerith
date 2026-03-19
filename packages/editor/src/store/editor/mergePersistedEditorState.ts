import type { EditorState } from './types';

import { extractPersistedEditorState } from './persistence';

type DockLayoutNormalizer = (state: unknown) => {
    dockLayoutJson: unknown;
    dockLayoutVersion: number;
};

export function mergePersistedEditorState(
    current: EditorState,
    persisted: unknown,
    normalizeDockLayout: DockLayoutNormalizer,
): EditorState {
    const persistedState = extractPersistedEditorState(persisted);
    const normalized = normalizeDockLayout(persisted);

    return {
        ...current,
        breakpoints: persistedState.breakpoints ?? current.breakpoints,
        dockLayoutJson: normalized.dockLayoutJson,
        dockLayoutVersion: normalized.dockLayoutVersion,
    };
}

