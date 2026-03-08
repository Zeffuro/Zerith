import type { ClipboardValidationAssetSlice, EditorSet } from '../types';

export function createClipboardValidationAssetSlice(set: EditorSet): ClipboardValidationAssetSlice {
    return {
        clearValidationErrors: () => set({ validationErrors: {} }),
        clipboardNode: undefined,

        selectedAssetPath: undefined,
        setClipboardNode: (node) => set({ clipboardNode: node }),
        setSelectedAssetPath: (path) => set({ selectedAssetPath: path }),

        setValidationErrors: (errors) => set({ validationErrors: errors }),
        validationErrors: {},
    };
}

