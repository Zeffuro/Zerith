import type { ClipboardValidationAssetSlice, EditorSet } from '../types';

export function createClipboardValidationAssetSlice(set: EditorSet): ClipboardValidationAssetSlice {
    return {
        clipboardNode: null,
        setClipboardNode: (node) => set({ clipboardNode: node }),

        validationErrors: {},
        setValidationErrors: (errors) => set({ validationErrors: errors }),
        clearValidationErrors: () => set({ validationErrors: {} }),

        selectedAssetPath: null,
        setSelectedAssetPath: (path) => set({ selectedAssetPath: path }),
    };
}

