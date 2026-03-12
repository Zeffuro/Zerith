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
                    autosaveIntervalMs: persistedState.autosaveIntervalMs ?? current.autosaveIntervalMs,
                    dockLayoutJson: normalized.dockLayoutJson,
                    dockLayoutVersion: normalized.dockLayoutVersion,
                    recentProjects: persistedState.recentProjects ?? current.recentProjects,
                    windowState: persistedState.windowState ?? current.windowState,
                };
            },
            name: 'zerith-editor-prefs',
            partialize: (state) => ({
                autosaveEnabled: state.autosaveEnabled,
                autosaveIntervalMs: state.autosaveIntervalMs,
                breakpoints: state.breakpoints,
                dockLayoutJson: state.dockLayoutJson,
                dockLayoutVersion: state.dockLayoutVersion,
                isMuted: state.isMuted,
                quickCommandTypes: state.quickCommandTypes,
                recentProjects: state.recentProjects,
                themeKey: state.themeKey,
                uiScale: state.uiScale,
                windowState: state.windowState,
            }),
        }
    )
);