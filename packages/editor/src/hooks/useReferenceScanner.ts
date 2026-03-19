import { useEffect } from 'react';

import { collectDataAssetReferences, listProjectAssetFiles, scanReferences } from '../services/referenceScanner';
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
                    useReferenceStore.getState().setResult({ assetFiles: {}, assets: {}, characters: {}, variables: {} });
                    return;
                }

                const projectData = useProjectStore.getState();
                const result = scanReferences(projectData);
                await collectDataAssetReferences(projectData, result);
                const assetInventory = await listProjectAssetFiles(projectPath);

                if (cancelled) return;
                useReferenceStore.getState().setResult(result);
                useReferenceStore.getState().setAssetInventory(assetInventory);
            })();
        }, 500);

        return () => {
            cancelled = true;
            globalThis.clearTimeout(timeout);
        };
    }, [characters, macros, projectPath, scenes, treeRevision]);
}

