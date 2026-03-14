import { useEffect, useMemo } from 'react';

import { useProjectStore } from '../store/storeBootstrap';
import { useEditorStore } from '../store/useEditorStore';

export function useAutosave() {
    const autosaveEnabled = useEditorStore((state) => state.autosaveEnabled);
    const autosaveIntervalMs = useEditorStore((state) => state.autosaveIntervalMs);
    const lastManualSaveAt = useEditorStore((state) => state.lastManualSaveAt);

    const dirtyFiles = useProjectStore((state) => state.dirtyFiles);
    const saveAllDirtyFiles = useProjectStore((state) => state.saveAllDirtyFiles);

    const dirtySignature = useMemo(() => {
        return [...dirtyFiles].toSorted().join('|');
    }, [dirtyFiles]);

    useEffect(() => {
        if (!autosaveEnabled || dirtyFiles.size === 0) return;

        const intervalId = globalThis.setInterval(() => {
            void saveAllDirtyFiles().catch((error: unknown) => {
                console.error('Autosave failed:', error);
            });
        }, autosaveIntervalMs);

        return () => {
            globalThis.clearInterval(intervalId);
        };
    }, [autosaveEnabled, autosaveIntervalMs, dirtyFiles.size, dirtySignature, lastManualSaveAt, saveAllDirtyFiles]);
}

