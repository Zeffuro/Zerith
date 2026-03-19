import type { GameManifest } from 'core';

import { useEffect, useRef, useState } from 'react';

export function useSceneHotReload({
    manifest,
    projectPath,
    treeRevision,
}: {
    manifest: GameManifest | undefined;
    projectPath: string | undefined;
    treeRevision: number;
}): number {
    const [reloadToken, setReloadToken] = useState(0);
    const lastProjectPathReference = useRef<string | undefined>(undefined);
    const lastTreeRevisionReference = useRef<number | undefined>(undefined);

    useEffect(() => {
        if (!projectPath || !manifest) {
            lastProjectPathReference.current = undefined;
            lastTreeRevisionReference.current = undefined;
            return;
        }

        if (lastProjectPathReference.current !== projectPath) {
            lastProjectPathReference.current = projectPath;
            lastTreeRevisionReference.current = treeRevision;
            return;
        }

        if (lastTreeRevisionReference.current === undefined) {
            lastTreeRevisionReference.current = treeRevision;
            return;
        }

        if (lastTreeRevisionReference.current === treeRevision) return;

        lastTreeRevisionReference.current = treeRevision;
        setReloadToken((current) => current + 1);
    }, [manifest, projectPath, treeRevision]);

    return reloadToken;
}

