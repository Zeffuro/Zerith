import type { Script } from 'core';

import { useEffect, useMemo, useRef, useState } from 'react';

import { useEngineLifecycle } from '../hooks/useEngineLifecycle';
import { useEngineMute } from '../hooks/useEngineMute';
import { usePlaybackControl } from '../hooks/usePlaybackControl';
import {
    localizeSceneMapForPreview,
    localizeScriptForPreview,
    resolvePreviewLocaleBundle,
} from '../services/localizationPreview';
import { useProjectStore } from '../store/storeBootstrap';
import { useConsoleStore } from '../store/useConsoleStore';
import { useEditorStore } from '../store/useEditorStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { editorTheme as t } from '../theme/editorTheme';
import { createGamePreviewAccessibilityAttributes } from './gamePreviewAccessibility';

export function GamePreview({ script }: { script: Script }) {
    // Manifest data
    const {
        activeFile,
        characters,
        items,
        localePaths,
        locales,
        macros,
        manifest,
        projectPath,
        sceneNamespaces,
        scenePaths,
        scenes,
        treeRevision,
    } = useProjectStore();
    const isMuted = useSettingsStore((state) => state.isMuted);
    // Triggers
    const {
        pauseTrigger,
        playFromIndex,
        playTrigger,
        resumeTrigger,
        stepTrigger,
        stopTrigger,
    } = useEditorStore();
    const previewLocale = useEditorStore((state) => state.previewLocale);
    const setPreviewLogCaptureEnabled = useConsoleStore((state) => state.setPreviewLogCaptureEnabled);

    const canvasReference = useRef<HTMLCanvasElement>(null);
    const containerReference = useRef<HTMLDivElement>(null);
    const [isFocused, setIsFocused] = useState(false);
    const isStarted = playTrigger > stopTrigger;
    const previewAccessibility = useMemo(
        () => createGamePreviewAccessibilityAttributes({ isFocused, isStarted }),
        [isFocused, isStarted],
    );
    const playbackRequestIdReference = useRef(0);
    const { bundle: previewLocaleBundle, locale: resolvedPreviewLocale } = useMemo(
        () => resolvePreviewLocaleBundle(locales, previewLocale, manifest?.localization?.defaultLocale),
        [locales, manifest?.localization?.defaultLocale, previewLocale],
    );
    const activeSceneNamespace = useMemo(
        () => resolveActiveSceneNamespace(activeFile, sceneNamespaces, scenePaths),
        [activeFile, sceneNamespaces, scenePaths],
    );
    const localizedScript = useMemo(
        () => localizeScriptForPreview(script, previewLocaleBundle, activeSceneNamespace),
        [activeSceneNamespace, previewLocaleBundle, script],
    );
    const localizedScenes = useMemo(
        () => localizeSceneMapForPreview(scenes, sceneNamespaces, previewLocaleBundle),
        [previewLocaleBundle, sceneNamespaces, scenes],
    );
    const localizedMacros = useMemo(
        () => localizeSceneMapForPreview(macros, {}, previewLocaleBundle),
        [macros, previewLocaleBundle],
    );
    const localizationReloadKey = useMemo(
        () => `${resolvedPreviewLocale ?? 'source'}:${Object.keys(localePaths).length}:${JSON.stringify(previewLocaleBundle?.namespaces ?? {})}`,
        [localePaths, previewLocaleBundle?.namespaces, resolvedPreviewLocale],
    );
    const scriptReference = useRef(localizedScript);
    const projectDataReference = useRef({ characters, items, macros: localizedMacros, scenes: localizedScenes });
    const activeFileReference = useRef(activeFile);

    const handleFocus = () => {
        setIsFocused(true);
        engineReference.current?.setInputEnabled(true);
    };

    const handleBlur = () => {
        setIsFocused(false);
        engineReference.current?.setInputEnabled(false);
    };

    useEffect(() => {
        scriptReference.current = localizedScript;
    }, [localizedScript]);

    useEffect(() => {
        projectDataReference.current = {
            characters,
            items,
            macros: localizedMacros,
            scenes: localizedScenes,
        };
    }, [characters, items, localizedMacros, localizedScenes]);

    useEffect(() => {
        activeFileReference.current = activeFile;
    }, [activeFile]);

    const engineReference = useEngineLifecycle({
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
    });

    useEngineMute({ engineReferenceRef: engineReference, isMuted });

    usePlaybackControl({
        containerReference,
        engineReference,
        pauseTrigger,
        playbackRequestIdRef: playbackRequestIdReference,
        playFromIndex,
        playTrigger,
        resumeTrigger,
        scriptRef: scriptReference,
        stepTrigger,
        stopTrigger,
    });


    return (
        <div
            {...previewAccessibility.container}
            onBlur={handleBlur}
            onFocus={handleFocus}
            ref={containerReference}
            style={{
                backgroundColor: t.bg.preview,
                border: isFocused ? `2px solid ${t.border.focus}` : '2px solid transparent',
                height: '100%',
                outline: 'none',
                overflow: 'hidden',
                position: 'relative',
                transition: 'border-color 0.2s',
                width: '100%',
            }}
        >
            <canvas {...previewAccessibility.canvas} ref={canvasReference} />
            {!isFocused && isStarted && (
                <div
                    {...previewAccessibility.focusHint}
                    style={{
                        background: 'rgba(0,0,0,0.6)',
                        borderRadius: '4px',
                        bottom: 10,
                        color: t.text.muted,
                        fontSize: '10px',
                        padding: '4px 8px',
                        pointerEvents: 'none',
                        position: 'absolute',
                        right: 10,
                    }}
                >
                    Click to control
                </div>
            )}
        </div>
    );
}

function normalizeFilePath(path: string): string {
    return path.replaceAll('\\', '/').replaceAll(/\/+/gu, '/');
}

function resolveActiveSceneNamespace(
    activeFile: string | undefined,
    sceneNamespaces: Record<string, string | undefined>,
    scenePaths: Record<string, string | undefined>,
): string | undefined {
    if (!activeFile) return;
    const normalizedActiveFile = normalizeFilePath(activeFile);

    for (const [sceneName, scenePath] of Object.entries(scenePaths)) {
        if (!scenePath) continue;
        if (normalizeFilePath(scenePath) === normalizedActiveFile) {
            return sceneNamespaces[sceneName] ?? `scene.${sceneName}`;
        }
    }

    return;
}


