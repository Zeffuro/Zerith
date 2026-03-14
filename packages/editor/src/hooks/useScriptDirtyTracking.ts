import { useEffect, useRef } from 'react';

import { useProjectStore } from '../store/storeBootstrap';
import { useScriptStore } from '../store/storeBootstrap';

export function useScriptDirtyTracking() {
    const activeFile = useProjectStore((state) => state.activeFile);
    const markFileDirty = useProjectStore((state) => state.markFileDirty);
    const rootScript = useScriptStore((state) => state.rootScript);

    const previousActiveFileReference = useRef<string | undefined>(undefined);
    const signatureByFileReference = useRef<Record<string, string>>({});

    useEffect(() => {
        if (!activeFile) {
            previousActiveFileReference.current = undefined;
            return;
        }

        const signature = JSON.stringify(rootScript);
        const switchedFiles = previousActiveFileReference.current !== activeFile;
        previousActiveFileReference.current = activeFile;

        if (switchedFiles || signatureByFileReference.current[activeFile] === undefined) {
            signatureByFileReference.current[activeFile] = signature;
            return;
        }

        if (signatureByFileReference.current[activeFile] !== signature) {
            signatureByFileReference.current[activeFile] = signature;
            markFileDirty(activeFile);
        }
    }, [activeFile, markFileDirty, rootScript]);
}

