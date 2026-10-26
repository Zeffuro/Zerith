import { useLayoutEffect } from 'react';

import { refreshReferenceScannerState } from '../services/referenceScanner';
import { referenceScannerInputsChanged } from '../services/referenceScanner/ownership';
import { executeConsoleMessageAction } from '../store/actions/consoleMessageActions';
import { useProjectStore } from '../store/storeBootstrap';

export function useReferenceScanner() {
    useLayoutEffect(() => {
        let active = true;
        let sequence = 0;
        let timeout: ReturnType<typeof setTimeout> | undefined;
        const schedule = () => {
            globalThis.clearTimeout(timeout);
            const request = ++sequence;
            const project = useProjectStore.getState();
            if (!project.projectPath) return;
            const isCurrent = () => active && request === sequence
                && !referenceScannerInputsChanged(useProjectStore.getState(), project);
            timeout = globalThis.setTimeout(() => {
                void refreshReferenceScannerState(isCurrent, error => {
                    executeConsoleMessageAction('editor', 'error', 'Reference scan failed:', String(error));
                }).catch(() => {});
            }, 500);
        };
        const unsubscribe = useProjectStore.subscribe((current, previous) => {
            if (referenceScannerInputsChanged(current, previous)) schedule();
        });
        schedule();
        return () => {
            active = false;
            sequence++;
            unsubscribe();
            globalThis.clearTimeout(timeout);
        };
    }, []);
}

