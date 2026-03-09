import type { CharacterDefinition } from 'core';
import type { EvidenceItem } from 'core';

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
        charactersReference.current = characters;
        itemsReference.current = items;
        macrosReference.current = macros;
        scenesReference.current = scenes;
    }, [characters, items, macros, scenes]);

    useEffect(() => {
        if (!canvasReference.current || !projectPath || !manifest) return;
        let destroyed = false;
        const bootstrapCharacters = charactersReference.current as Record<string, CharacterDefinition>;
        const bootstrapItems = itemsReference.current as Record<string, Omit<EvidenceItem, 'id'>>;
        const bootstrapMacros = macrosReference.current as Record<string, Script>;
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
            const scenes = engine.scenes;
            scenes.addScene('preview', scriptReference.current);
            void scenes.jumpToScene('preview');
        });
        return () => { destroyed = true; engineReference.current?.destroy(); engineReference.current = undefined; };
    }, [projectPath, manifest]);

    // Play
    useEffect(() => {
        if (engineReference.current && playTrigger > 0) {
            const startIndex = typeof playFromIndexReference.current === 'number' ? playFromIndexReference.current : 0;
            engineReference.current.clear();
            const scenes = engineReference.current.scenes;
             
            scenes.addScene('preview', scriptReference.current);
            void scenes.jumpToScene('preview', startIndex);
            void engineReference.current.start();
            containerReference.current?.focus();
        }
    }, [playTrigger]);

    useEffect(() => {
        if (engineReference.current && stopTrigger > 0) {
            engineReference.current.clear();
            const scenes = engineReference.current.scenes;
             
            scenes.addScene('preview', scriptReference.current);
            void scenes.jumpToScene('preview', 0);
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