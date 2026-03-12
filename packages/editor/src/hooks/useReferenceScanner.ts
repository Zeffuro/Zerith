import { useEffect } from 'react';

import { scanReferences } from '../services/referenceScanner';
import { useProjectStore } from '../store/useProjectStore';
import { useReferenceStore } from '../store/useReferenceStore';

export function useReferenceScanner() {
    const projectPath = useProjectStore((state) => state.projectPath);
    const scenes = useProjectStore((state) => state.scenes);
    const macros = useProjectStore((state) => state.macros);
    const characters = useProjectStore((state) => state.characters);
    const treeRevision = useProjectStore((state) => state.treeRevision);

    useEffect(() => {
        const timeout = globalThis.setTimeout(() => {
            if (!projectPath) {
                useReferenceStore.getState().setResult({ assets: {}, characters: {}, variables: {} });
                return;
            }

            const projectData = useProjectStore.getState();
            const result = scanReferences(projectData);
            useReferenceStore.getState().setResult(result);
        }, 500);

        return () => globalThis.clearTimeout(timeout);
    }, [characters, macros, projectPath, scenes, treeRevision]);
}

