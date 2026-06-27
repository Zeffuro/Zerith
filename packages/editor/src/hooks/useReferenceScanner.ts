import { useEffect } from 'react';

import { buildReferenceScannerState } from '../services/referenceScanner';
import { useProjectStore } from '../store/storeBootstrap';
import { useReferenceStore } from '../store/useReferenceStore';

export function useReferenceScanner() {
    const projectPath = useProjectStore((state) => state.projectPath);
    const scenes = useProjectStore((state) => state.scenes);
    const macros = useProjectStore((state) => state.macros);
    const characters = useProjectStore((state) => state.characters);
    const treeRevision = useProjectStore((state) => state.treeRevision);

    useEffect(() => {
        let cancelled = false;

        const timeout = globalThis.setTimeout(() => {
            void (async () => {
                if (!projectPath) {
                    if (cancelled) return;
                    useReferenceStore.getState().setAssetInventory([]);
                    useReferenceStore.getState().setResult({ assetFiles: {}, assets: {}, characters: {}, items: {}, variables: {} });
                    return;
                }

                const nextState = await buildReferenceScannerState(useProjectStore.getState());

                if (cancelled) return;
                useReferenceStore.getState().setResult(nextState.result);
                useReferenceStore.getState().setAssetInventory(nextState.assetInventory);
            })();
        }, 500);

        return () => {
            cancelled = true;
            globalThis.clearTimeout(timeout);
        };
    }, [characters, macros, projectPath, scenes, treeRevision]);
}

