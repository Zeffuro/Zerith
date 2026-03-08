import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createClipboardValidationAssetSlice } from './editor/slices/clipboardValidationAssetSlice';
import { createDockLayoutSlice, normalizeDockLayoutState } from './editor/slices/dockLayoutSlice';
import { createPlaybackQuickCommandsSlice } from './editor/slices/playbackQuickCommandsSlice';
import { createSelectionSlice } from './editor/slices/selectionSlice';
import { createUiPrefsSlice } from './editor/slices/uiPrefsSlice';
import type { EditorState } from './editor/types';

export const useEditorStore = create<EditorState>()(
    persist(
        (set, _) => ({
            ...createUiPrefsSlice(set),
            ...createPlaybackQuickCommandsSlice(set),

            ...createClipboardValidationAssetSlice(set),

            ...createSelectionSlice(set),


            ...createDockLayoutSlice(set),
        }),
        {
            name: 'zerith-editor-prefs',
            partialize: (state) => ({
                uiScale: state.uiScale,
                isMuted: state.isMuted,
                windowState: state.windowState,
                quickCommandTypes: state.quickCommandTypes,
                themeKey: state.themeKey,
                dockLayoutJson: state.dockLayoutJson,
                dockLayoutVersion: state.dockLayoutVersion,
            }),
            merge: (persisted: any, current) => {
                const normalized = normalizeDockLayoutState(persisted);
                return {
                    ...current,
                    ...persisted,
                    dockLayoutJson: normalized.dockLayoutJson,
                    dockLayoutVersion: normalized.dockLayoutVersion,
                };
            },
        }
    )
);