import type { EditorSet, OperationStatusSlice } from '../types';

export function createOperationStatusSlice(set: EditorSet): OperationStatusSlice {
    return {
        announceOperationStatus: (message, tone = 'info') => {
            set({
                lastOperationStatus: {
                    id: Date.now(),
                    message,
                    tone,
                },
            });
        },
        clearOperationStatus: () => set({ lastOperationStatus: undefined }),
        lastOperationStatus: undefined,
    };
}
