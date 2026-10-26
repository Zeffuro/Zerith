import type { GameManifest, Script } from '@zeffuro/zerith-core';
import type { RefObject } from 'react';

import { useMemo } from 'react';

import type { EngineLifecycleProjectData } from './useEngineBootstrap';

import { useProjectStore } from '../store/storeBootstrap';
import { useEngineBootstrap } from './useEngineBootstrap';
import { useSceneHotReload } from './useSceneHotReload';

type WritableReference<T> = { current: T };

export function useEngineLifecycle({
    activeFileReference,
    canvasReference,
    containerReference,
    localizationReloadKey,
    manifest,
    playbackRequestIdReference,
    projectDataReference,
    projectPath,
    scriptReference,
    setPreviewLogCaptureEnabled,
    treeRevision,
}: {
    activeFileReference: RefObject<string | undefined>;
    canvasReference: RefObject<HTMLCanvasElement | null>;
    containerReference: RefObject<HTMLDivElement | null>;
    localizationReloadKey: string;
    manifest: GameManifest | undefined;
    playbackRequestIdReference: WritableReference<number>;
    projectDataReference: WritableReference<EngineLifecycleProjectData>;
    projectPath: string | undefined;
    scriptReference: WritableReference<Script>;
    setPreviewLogCaptureEnabled: (enabled: boolean) => void;
    treeRevision: number;
}) {
    const reloadToken = useSceneHotReload({ manifest, projectPath, treeRevision });
    const projectGeneration = useProjectStore(state => state.projectGeneration);
    const { key: canvasKey } = useMemo(() => ({ key: crypto.randomUUID(), localizationReloadKey, manifest, projectGeneration, projectPath, reloadToken }),
        [localizationReloadKey, manifest, projectGeneration, projectPath, reloadToken]);

    const engineReference = useEngineBootstrap({
        activeFileReference,
        canvasKey,
        canvasReference,
        containerReference,
        localizationReloadKey,
        manifest,
        playbackRequestIdReference,
        projectDataReference,
        projectPath,
        reloadToken,
        scriptReference,
        setPreviewLogCaptureEnabled,
    });
    return { canvasKey, engineReference };
}

