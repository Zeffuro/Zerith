import { useEffect } from 'react';

import { startRecoverySession } from '../services/recovery/recoverySession';
import { useEditorStore } from '../store/useEditorStore';

export function useUnsavedWorkRecovery(): void {
    useEffect(() => {
        try { return startRecoverySession(); }
        catch (error) {
            useEditorStore.getState().announceOperationStatus(`Unsaved work recovery is unavailable: ${error instanceof Error ? error.message : String(error)}`, 'warning');
        }
    }, []);
}
