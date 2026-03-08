import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { EditorState } from './editor/types';

import { extractPersistedEditorState } from './editor/persistence';
import { createClipboardValidationAssetSlice } from './editor/slices/clipboardValidationAssetSlice';
import { createDockLayoutSlice, normalizeDockLayoutState } from './editor/slices/dockLayoutSlice';
import { createPlaybackQuickCommandsSlice } from './editor/slices/playbackQuickCommandsSlice';
import { createSelectionSlice } from './editor/slices/selectionSlice';
import { createUiPrefsSlice } from './editor/slices/uiPrefsSlice';


export const useEditorStore = create<EditorState>()(
    persist(
        (set) => ({
            ...createUiPrefsSlice(set),
            ...createPlaybackQuickCommandsSlice(set),
            ...createClipboardValidationAssetSlice(set),
            ...createSelectionSlice(set),
            ...createDockLayoutSlice(set),
        }),
        {
            merge: (persisted: unknown, current) => {
                const persistedState = extractPersistedEditorState(persisted);
                const normalized = normalizeDockLayoutState(persisted);
                return {
                    ...current,
                    ...persistedState,
                    dockLayoutJson: normalized.dockLayoutJson,
                    dockLayoutVersion: normalized.dockLayoutVersion,
                };
            },
            name: 'zerith-editor-prefs',
            partialize: (state) => ({
                dockLayoutJson: state.dockLayoutJson,
                dockLayoutVersion: state.dockLayoutVersion,
                isMuted: state.isMuted,
                quickCommandTypes: state.quickCommandTypes,
                themeKey: state.themeKey,
                uiScale: state.uiScale,
                windowState: state.windowState,
            }),
        }
    )
);