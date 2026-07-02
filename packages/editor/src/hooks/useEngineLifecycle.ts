import type { CharacterDefinition, Engine, GameManifest, ItemManifestEntry, SceneMap, Script } from '@zeffuro/zerith-core';
import type { RefObject } from 'react';

import { useEngineBootstrap } from './useEngineBootstrap';
import { useSceneHotReload } from './useSceneHotReload';

export type EngineLifecycleProjectData = {
    characters: Record<string, CharacterDefinition>;
    items: Record<string, ItemManifestEntry>;
    macros: Record<string, Script>;
    scenes: SceneMap;
};

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
}): WritableReference<Engine | undefined> {
    const reloadToken = useSceneHotReload({ manifest, projectPath, treeRevision });

    return useEngineBootstrap({
        activeFileReference,
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
}

