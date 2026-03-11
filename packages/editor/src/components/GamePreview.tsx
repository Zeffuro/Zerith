import type { EvidenceItem, ItemManifestEntry } from 'core';

import { convertFileSrc } from "@tauri-apps/api/core";
import { bootstrapEngine, Engine, type Script } from 'core';
import { useEffect, useRef, useState } from 'react';

import { useEditorStore } from '../store/useEditorStore';
import { useProjectStore } from '../store/useProjectStore';

export function GamePreview({ script }: { script: Script }) {
    // Manifest data
    const { characters, items, macros, manifest, projectPath, scenes } = useProjectStore();
    // Triggers
    const { isMuted, playFromIndex, playTrigger, stopTrigger } = useEditorStore();

    const canvasReference = useRef<HTMLCanvasElement>(null);
    const containerReference = useRef<HTMLDivElement>(null);
    const engineReference = useRef<Engine | undefined>(undefined);
    const [isFocused, setIsFocused] = useState(false);
    const isStarted = playTrigger > stopTrigger;
    const playIntentReference = useRef(isStarted);
    const scriptReference = useRef(script);
    const playFromIndexReference = useRef(playFromIndex);
    const charactersReference = useRef(characters);
    const itemsReference = useRef(items);
    const macrosReference = useRef(macros);
    const scenesReference = useRef(scenes);

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
        playFromIndexReference.current = playFromIndex;
    }, [playFromIndex]);

    useEffect(() => {
        playIntentReference.current = isStarted;
    }, [isStarted]);

    useEffect(() => {
        charactersReference.current = characters;
        itemsReference.current = items;
        macrosReference.current = macros;
        scenesReference.current = scenes;
    }, [characters, items, macros, scenes]);

    useEffect(() => {
        if (!canvasReference.current || !projectPath || !manifest) return;
        let destroyed = false;
        const bootstrapCharacters = charactersReference.current;
        const bootstrapItems = toEvidenceDefinitions(itemsReference.current);
        const bootstrapMacros = macrosReference.current;
        const bootstrapScenes = scenesReference.current;
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
            }, defaultBlipUrl: '/assets/sfx/blip.wav', items: bootstrapItems, macros: bootstrapMacros,
            manifest,
            scenes: bootstrapScenes,
        }).then(engine => {
            if (destroyed) { engine.destroy(); return; }
            engine.stateManager.setPersistent('projectPath', projectPath);
            engineReference.current = engine;
            engine.setInputEnabled(false);

            if (playIntentReference.current) {
                startPreviewPlayback(engine, scriptReference.current, playFromIndexReference.current);
                containerReference.current?.focus();
                return;
            }

            const sceneManager = engine.scenes;
            sceneManager.addScene('preview', scriptReference.current);
            void sceneManager.jumpToScene('preview');
        });
        return () => { destroyed = true; engineReference.current?.destroy(); engineReference.current = undefined; };
    }, [projectPath, manifest]);

    // Play
    useEffect(() => {
        if (engineReference.current && playTrigger > 0) {
            startPreviewPlayback(engineReference.current, scriptReference.current, playFromIndexReference.current);
            containerReference.current?.focus();
        }
    }, [playTrigger]);

    useEffect(() => {
        if (engineReference.current && stopTrigger > 0) {
            engineReference.current.clear();
            const sceneManager = engineReference.current.scenes;
            sceneManager.addScene('preview', scriptReference.current);
            void sceneManager.jumpToScene('preview', 0);
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

function startPreviewPlayback(engine: Engine, script: Script, playFromIndex: number | undefined): void {
    const startIndex = typeof playFromIndex === 'number' ? playFromIndex : 0;
    engine.clear();
    const sceneManager = engine.scenes;
    sceneManager.addScene('preview', script);
    void sceneManager.jumpToScene('preview', startIndex);
    void engine.start();
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
