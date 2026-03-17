import type { CharacterDefinition, Engine, EngineConfig, GameManifest, ItemManifestEntry, SceneMap, Script } from 'core';
import type { RefObject } from 'react';

import { convertFileSrc } from '@tauri-apps/api/core';
import { bootstrapEngine, EngineConfigSchema, type EvidenceItem } from 'core';
import { useEffect, useRef } from 'react';

import { fsJoin, fsReadTextFile } from '../services/fs';
import { createGamePreviewLogger } from '../services/gamePreviewLoggerBridge';
import { useEditorStore } from '../store/useEditorStore';
import { useEngineBridgeStore } from '../store/useEngineBridgeStore';
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
        fontFamily: 'Courier New',
        fontSize: 24,
    },
};

export function useEngineLifecycle({
    activeFileReference,
    canvasReference,
    containerReference,
    manifest,
    playbackRequestIdReference,
    projectDataReference,
    projectPath,
    scriptReference,
    setPreviewLogCaptureEnabled,
}: {
    activeFileReference: RefObject<string | undefined>;
    canvasReference: RefObject<HTMLCanvasElement | null>;
    containerReference: RefObject<HTMLDivElement | null>;
    manifest: GameManifest | undefined;
    playbackRequestIdReference: WritableReference<number>;
    projectDataReference: WritableReference<EngineLifecycleProjectData>;
    projectPath: string | undefined;
    scriptReference: WritableReference<Script>;
    setPreviewLogCaptureEnabled: (enabled: boolean) => void;
}): WritableReference<Engine | undefined> {
    const detachFlowListenersReference = useRef<(() => void) | undefined>(undefined);
    const engineReference = useRef<Engine | undefined>(undefined);
    const { attachDebugBridge } = useDebugBridge();

    useEffect(() => {
        if (!canvasReference.current || !projectPath || !manifest) return;

        let destroyed = false;
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

            const effectiveConfig: EngineConfig = {
                ...PreviewDefaultEngineConfig,
                ...loadedEngineConfig,
                audio: {
                    ...PreviewDefaultEngineConfig.audio,
                    ...loadedEngineConfig?.audio,
                    muted: useSettingsStore.getState().isMuted,
                },
                display: {
                    ...PreviewDefaultEngineConfig.display,
                    ...loadedEngineConfig?.display,
                },
                onSceneNavigation: () => 'skip',
                theme: {
                    ...PreviewDefaultEngineConfig.theme,
                    ...loadedEngineConfig?.theme,
                },
            };

            const engine = await bootstrapEngine({
                assetResolver: (url: string) => {
                    if (projectPath && !url.startsWith('http')) return convertFileSrc(projectPath + url);
                    return url;
                },
                canvas,
                characters: bootstrapCharacters,
                config: effectiveConfig,
                defaultBlipUrl: '/assets/sfx/blip.wav',
                items: toEvidenceDefinitions(bootstrapItems),
                macros: bootstrapMacros,
                manifest,
                scenes: bootstrapScenes,
            });

            if (destroyed) {
                engine.destroy();
                return;
            }

            engine.logger = createGamePreviewLogger();
            setPreviewLogCaptureEnabled(true);
            engine.stateManager.setPersistent('projectPath', projectPath);
            engineReference.current = engine;
            useEngineBridgeStore.getState().setEngine(engine);
            engine.setInputEnabled(false);

            detachFlowListenersReference.current = attachDebugBridge(engine, activeFileReference);

            const playbackState = useEditorStore.getState();
            const shouldAutoplay = playbackState.playTrigger > playbackState.stopTrigger;
            if (shouldAutoplay) {
                const requestId = ++playbackRequestIdReference.current;
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
        })();

        return () => {
            destroyed = true;
            setPreviewLogCaptureEnabled(false);
            detachFlowListenersReference.current?.();
            detachFlowListenersReference.current = undefined;
            useEditorStore.getState().clearActiveExecutionPath();
            useEditorStore.getState().setPlaybackPaused(false);
            engineReference.current?.destroy();
            engineReference.current = undefined;
            useEngineBridgeStore.getState().setEngine(undefined);
        };
    }, [
        activeFileReference,
        attachDebugBridge,
        canvasReference,
        containerReference,
        manifest,
        playbackRequestIdReference,
        projectDataReference,
        projectPath,
        scriptReference,
        setPreviewLogCaptureEnabled,
    ]);


    return engineReference;
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

function isLikelyMissingFileError(caughtError: unknown): boolean {
    if (!(caughtError instanceof Error)) return false;
    const message = caughtError.message.toLowerCase();
    return message.includes('cannot find') || message.includes('no such file') || message.includes('not found');
}

