import type { EvidenceItem, ItemManifestEntry } from 'core';

import { convertFileSrc } from "@tauri-apps/api/core";
import { bootstrapEngine, Engine, type Script } from 'core';
import { useEffect, useRef, useState } from 'react';

import { createGamePreviewLogger } from '../services/gamePreviewLoggerBridge';
import { useConsoleStore } from '../store/useConsoleStore';
import { useEditorStore } from '../store/useEditorStore';
import { useProjectStore } from '../store/useProjectStore';

export function GamePreview({ script }: { script: Script }) {
    // Manifest data
    const { characters, items, macros, manifest, projectPath, scenes } = useProjectStore();
    // Triggers
    const { isMuted, playFromIndex, playTrigger, stopTrigger } = useEditorStore();
    const setPreviewLogCaptureEnabled = useConsoleStore((state) => state.setPreviewLogCaptureEnabled);

    const canvasReference = useRef<HTMLCanvasElement>(null);
    const containerReference = useRef<HTMLDivElement>(null);
    const engineReference = useRef<Engine | undefined>(undefined);
    const [isFocused, setIsFocused] = useState(false);
    const isStarted = playTrigger > stopTrigger;
    const playbackRequestIdReference = useRef(0);
    const scriptReference = useRef(script);
    const projectDataReference = useRef({ characters, items, macros, scenes });

    const handleFocus = () => {
        setIsFocused(true);
        engineReference.current?.setInputEnabled(true);
    };

    const handleBlur = () => {
        setIsFocused(false);
        engineReference.current?.setInputEnabled(false);
    };

    useEffect(() => {
        scriptReference.current = script;

        if (engineReference.current) engineReference.current.scenes.addScene('preview', script);
    }, [script]);

    useEffect(() => {
        projectDataReference.current = { characters, items, macros, scenes };
    }, [characters, items, macros, scenes]);

    useEffect(() => {
        if (!canvasReference.current || !projectPath || !manifest) return;
        let destroyed = false;
        const {
            characters: bootstrapCharacters,
            items: bootstrapItems,
            macros: bootstrapMacros,
            scenes: bootstrapScenes,
        } = projectDataReference.current;
        void bootstrapEngine({
            assetResolver: (url: string) => {
                if (projectPath && !url.startsWith('http')) return convertFileSrc(projectPath + url);
                return url;
            },
            canvas: canvasReference.current,
            characters: bootstrapCharacters, config: {
                audio: { muted: useEditorStore.getState().isMuted },
                display: { height: 720, scaleMode: 'fit', width: 1280 },
                onSceneNavigation: () => 'skip',
                theme: { boxColor: 0x00_00_33, fontFamily: 'Courier New', fontSize: 24 },
            }, defaultBlipUrl: '/assets/sfx/blip.wav', items: toEvidenceDefinitions(bootstrapItems), macros: bootstrapMacros,
            manifest,
            scenes: bootstrapScenes,
        }).then(engine => {
            if (destroyed) { engine.destroy(); return; }
            engine.logger = createGamePreviewLogger();
            setPreviewLogCaptureEnabled(true);
            engine.stateManager.setPersistent('projectPath', projectPath);
            engineReference.current = engine;
            engine.setInputEnabled(false);

            const playbackState = useEditorStore.getState();
            const shouldAutoplay = playbackState.playTrigger > playbackState.stopTrigger;
            if (shouldAutoplay) {
                const requestId = ++playbackRequestIdReference.current;
                void startPreviewPlayback(engine, scriptReference.current, playbackState.playFromIndex, requestId, () => playbackRequestIdReference.current);
                containerReference.current?.focus();
                return;
            }

            const sceneManager = engine.scenes;
            sceneManager.addScene('preview', scriptReference.current);
            void sceneManager.jumpToScene('preview');
        });
        return () => {
            destroyed = true;
            setPreviewLogCaptureEnabled(false);
            engineReference.current?.destroy();
            engineReference.current = undefined;
        };
    }, [projectPath, manifest, setPreviewLogCaptureEnabled]);

    // Play
    useEffect(() => {
        if (engineReference.current && playTrigger > 0) {
            const requestId = ++playbackRequestIdReference.current;
            void startPreviewPlayback(
                engineReference.current,
                scriptReference.current,
                playFromIndex,
                requestId,
                () => playbackRequestIdReference.current,
            );
            containerReference.current?.focus();
        }
    }, [playFromIndex, playTrigger]);

    useEffect(() => {
        if (engineReference.current && stopTrigger > 0) {
            playbackRequestIdReference.current++;
            stopPreviewPlayback(engineReference.current, scriptReference.current);
            containerReference.current?.blur();
        }
    }, [stopTrigger]);

    // Mute
    useEffect(() => {
        if (engineReference.current) {
            engineReference.current.audio.muted = isMuted;
        }
    }, [isMuted]);

    return (
        <div
            onBlur={handleBlur}
            onFocus={handleFocus}
            ref={containerReference}
            style={{
                backgroundColor: '#000', border: isFocused ? '2px solid #007fd4' : '2px solid transparent', height: '100%', outline: 'none',
                overflow: 'hidden', position: 'relative',
                transition: 'border-color 0.2s',
                width: '100%'
            }}
            tabIndex={0}
        >
            <canvas ref={canvasReference} />
            {!isFocused && isStarted && (
                <div style={{ background: 'rgba(0,0,0,0.6)', borderRadius: '4px', bottom: 10, color: '#aaa', fontSize: '10px', padding: '4px 8px', pointerEvents: 'none', position: 'absolute', right: 10 }}>
                    Click to control
                </div>
            )}
        </div>
    );
}

async function startPreviewPlayback(
    engine: Engine,
    script: Script,
    playFromIndex: number | undefined,
    requestId: number,
    getLatestRequestId: () => number,
): Promise<void> {
    const requestedIndex = typeof playFromIndex === 'number' ? playFromIndex : 0;
    const startIndex = Math.min(Math.max(0, requestedIndex), Math.max(0, script.length - 1));

    engine.flow.stop();
    engine.clear();
    const sceneManager = engine.scenes;
    sceneManager.addScene('preview', script);
    await sceneManager.jumpToScene('preview', startIndex);

    if (requestId !== getLatestRequestId()) {
        return;
    }

    engine.start();
}

function stopPreviewPlayback(engine: Engine, script: Script): void {
    engine.flow.stop();
    engine.clear();
    engine.scenes.addScene('preview', script);
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
