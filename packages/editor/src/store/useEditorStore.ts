import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { EditorState } from './editor/types';

import { mergePersistedEditorState } from './editor/mergePersistedEditorState';
import { partializeEditorStateForPersistence } from './editor/persistShape';
import { createClipboardValidationAssetSlice } from './editor/slices/clipboardValidationAssetSlice';
import { createDockLayoutSlice, normalizeDockLayoutState } from './editor/slices/dockLayoutSlice';
import { createOperationStatusSlice } from './editor/slices/operationStatusSlice';
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
            ...createOperationStatusSlice(set),
        }),
        {
            merge: (persisted: unknown, current) => mergePersistedEditorState(current, persisted, normalizeDockLayoutState),
            name: 'zerith-editor-prefs',
            partialize: partializeEditorStateForPersistence,
        }
    )
);
