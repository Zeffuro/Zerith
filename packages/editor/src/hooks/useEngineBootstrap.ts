import type { CharacterDefinition, Engine, EngineConfig, GameManifest, ItemManifestEntry, SceneMap, Script } from '@zeffuro/zerith-core';
import type { RefObject } from 'react';

import { bootstrapEngine, EngineConfigSchema, type EvidenceItem } from '@zeffuro/zerith-core';
import { useEffect, useRef } from 'react';

import { fsJoin, fsReadTextFile } from '../services/fs';
import { createGamePreviewLogger } from '../services/gamePreviewLoggerBridge';
import { createPreviewFontOwner } from '../services/previewFont';
import { createPreviewSceneNavigationHandler } from '../services/previewSceneNavigation';
import { createProjectAssetResolver } from '../services/runtime/assetUrls';
import { useProjectStore } from '../store/storeBootstrap';
import { useEditorStore } from '../store/useEditorStore';
import { useEngineBridgeStore } from '../store/useEngineBridgeStore';
import { usePlaytestStore } from '../store/usePlaytestStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { useDebugBridge } from './useDebugBridge';
import { startPreviewPlayback } from './usePlaybackControl';

export type EngineLifecycleProjectData = {
    characters: Record<string, CharacterDefinition>;
    items: Record<string, ItemManifestEntry>;
    macros: Record<string, Script>;
    scenes: SceneMap;
};

type WritableReference<T> = { current: T };

const PreviewDefaultEngineConfig: EngineConfig = {
    audio: {
        muted: false,
    },
    display: {
        height: 720,
        scaleMode: 'fit',
        width: 1280,
    },
    theme: {
        boxColor: 0x00_00_33,
        fontFamily: 'Arial',
        fontSize: 24,
    },
};

export function useEngineBootstrap({
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
}: {
    activeFileReference: RefObject<string | undefined>;
    canvasReference: RefObject<HTMLCanvasElement | null>;
    containerReference: RefObject<HTMLDivElement | null>;
    localizationReloadKey: string;
    manifest: GameManifest | undefined;
    playbackRequestIdReference: WritableReference<number>;
    projectDataReference: WritableReference<EngineLifecycleProjectData>;
    projectPath: string | undefined;
    reloadToken: number;
    scriptReference: WritableReference<Script>;
    setPreviewLogCaptureEnabled: (enabled: boolean) => void;
}): WritableReference<Engine | undefined> {
    const detachFlowListenersReference = useRef<(() => void) | undefined>(undefined);
    const engineReference = useRef<Engine | undefined>(undefined);
    const projectGeneration = useProjectStore(state => state.projectGeneration);
    const { attachDebugBridge } = useDebugBridge();

    useEffect(() => {
        if (!canvasReference.current || !projectPath || !manifest) return;

        let destroyed = false;
        const isCurrent = () => !destroyed
            && useProjectStore.getState().projectPath === projectPath
            && useProjectStore.getState().projectGeneration === projectGeneration;
        const fontOwner = createPreviewFontOwner(projectPath, isCurrent);
        let assetResolver: ReturnType<typeof createProjectAssetResolver> | undefined;
        const canvas = canvasReference.current;
        if (!canvas) return;
        const {
            characters: bootstrapCharacters,
            items: bootstrapItems,
            macros: bootstrapMacros,
            scenes: bootstrapScenes,
        } = projectDataReference.current;

        void (async () => {
            const loadedEngineConfig = await loadProjectEngineConfig(projectPath);
            if (!isCurrent()) return;
            const useDisplayConfigInPreview = loadedEngineConfig?.preview?.useDisplayConfig !== false;

            const resolvedDisplayConfig = useDisplayConfigInPreview
                ? {
                    ...PreviewDefaultEngineConfig.display,
                    ...loadedEngineConfig?.display,
                }
                : PreviewDefaultEngineConfig.display;

            const resolvedTheme = {
                ...PreviewDefaultEngineConfig.theme,
                ...loadedEngineConfig?.theme,
            };

            if (resolvedTheme.fontFamily && typeof loadedEngineConfig?.preview?.fontAssetUrl === 'string') {
                await fontOwner.load(resolvedTheme.fontFamily, loadedEngineConfig.preview.fontAssetUrl);
            }
            if (!isCurrent()) return;

            const effectiveConfig: EngineConfig = {
                ...PreviewDefaultEngineConfig,
                ...loadedEngineConfig,
                audio: {
                    ...PreviewDefaultEngineConfig.audio,
                    ...loadedEngineConfig?.audio,
                    muted: useSettingsStore.getState().isMuted,
                },
                display: {
                    ...resolvedDisplayConfig,
                },
                onSceneNavigation: createPreviewSceneNavigationHandler(bootstrapScenes),
                theme: {
                    ...resolvedTheme,
                },
            };

            assetResolver = createProjectAssetResolver(projectPath);

            const engine = await bootstrapEngine({
                assetResolver: assetResolver.resolve,
                canvas,
                characters: bootstrapCharacters,
                config: effectiveConfig,
                items: toEvidenceDefinitions(bootstrapItems),
                macros: bootstrapMacros,
                manifest,
                scenes: bootstrapScenes,
            });

            if (!isCurrent()) {
                fontOwner.dispose();
                engine.destroy();
                assetResolver.dispose();
                return;
            }

            engine.logger = createGamePreviewLogger();
            setPreviewLogCaptureEnabled(true);
            engine.stateManager.setPersistent('projectPath', projectPath);
            engineReference.current = engine;
            useEngineBridgeStore.getState().setEngine(engine);
            engine.setInputEnabled(false);

            detachFlowListenersReference.current = attachDebugBridge(engine, activeFileReference);

            const playtest = usePlaytestStore.getState().request;
            if (playtest?.projectPath === projectPath && playtest.generation === useProjectStore.getState().projectGeneration) return;

            const playbackState = useEditorStore.getState();
            const shouldAutoplay = playbackState.playTrigger > playbackState.stopTrigger;
            if (shouldAutoplay) {
                const requestId = nextPlaybackRequestId(playbackRequestIdReference);
                void startPreviewPlayback(
                    engine,
                    scriptReference.current,
                    playbackState.playFromIndex,
                    requestId,
                    () => playbackRequestIdReference.current,
                );
                containerReference.current?.focus();
                return;
            }

            const sceneManager = engine.scenes;
            sceneManager.addScene('preview', scriptReference.current);
            void sceneManager.jumpToScene('preview');
        })().catch((caughtError: unknown) => {
            assetResolver?.dispose();
            fontOwner.dispose();
            if (isCurrent()) console.warn('[preview] Failed to bootstrap preview:', caughtError);
        });

        return () => {
            destroyed = true;
            fontOwner.dispose();
            setPreviewLogCaptureEnabled(false);
            detachFlowListenersReference.current?.();
            detachFlowListenersReference.current = undefined;
            useEditorStore.getState().clearActiveExecutionPath();
            useEditorStore.getState().setPlaybackPaused(false);
            engineReference.current?.destroy();
            engineReference.current = undefined;
            assetResolver?.dispose();
            useEngineBridgeStore.getState().setEngine(undefined);
        };
    }, [
        activeFileReference,
        attachDebugBridge,
        canvasReference,
        containerReference,
        localizationReloadKey,
        manifest,
        playbackRequestIdReference,
        projectDataReference,
        projectGeneration,
        projectPath,
        reloadToken,
        scriptReference,
        setPreviewLogCaptureEnabled,
    ]);

    return engineReference;
}

function isLikelyMissingFileError(caughtError: unknown): boolean {
    if (!(caughtError instanceof Error)) return false;
    const message = caughtError.message.toLowerCase();
    return message.includes('cannot find') || message.includes('no such file') || message.includes('not found');
}

async function loadProjectEngineConfig(projectPath: string): Promise<EngineConfig | undefined> {
    try {
        const configPath = await fsJoin(projectPath, 'engine.config.json');
        const contents = await fsReadTextFile(configPath);
        const parsed: unknown = JSON.parse(contents);
        const result = EngineConfigSchema.safeParse(parsed);

        if (!result.success) {
            console.warn('[preview] Ignoring invalid engine.config.json:', result.error.issues[0]?.message ?? 'schema validation failed');
            return;
        }

        return result.data as EngineConfig;
    } catch (caughtError: unknown) {
        if (!isLikelyMissingFileError(caughtError)) {
            console.warn('[preview] Failed to load engine.config.json:', caughtError);
        }
        return;
    }
}

function nextPlaybackRequestId(reference: WritableReference<number>): number {
    const nextValue = reference.current + 1;
    reference.current = nextValue;
    return nextValue;
}

function toEvidenceDefinitions(
    items: Record<string, ItemManifestEntry>
): Record<string, Omit<EvidenceItem, 'id'>> {
    const next: Record<string, Omit<EvidenceItem, 'id'>> = {};
    for (const [key, item] of Object.entries(items)) {
        next[key] = {
            ...item,
            type: item.type === 'profile' ? 'profile' : 'evidence',
        };
    }
    return next;
}

