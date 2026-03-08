import { convertFileSrc } from "@tauri-apps/api/core";
import { bootstrapEngine, Engine } from 'core';
import { useEffect, useRef, useState } from 'react';

import { useEditorStore } from '../store/useEditorStore';
import { useProjectStore } from '../store/useProjectStore';

export function GamePreview({ script }: { script: any[] }) {
    // Manifest data
    const { characters, items, macros, manifest, projectPath, scenes } = useProjectStore();
    // Triggers
    const { isMuted, playFromIndex, playTrigger, stopTrigger } = useEditorStore();

    const canvasReference = useRef<HTMLCanvasElement>(null);
    const containerReference = useRef<HTMLDivElement>(null);
    const engineReference = useRef<Engine | null>(null);
    const [isFocused, setIsFocused] = useState(false);

    const handleFocus = () => {
        setIsFocused(true);
        engineReference.current?.setInputEnabled(true);
    };

    const handleBlur = () => {
        setIsFocused(false);
        engineReference.current?.setInputEnabled(false);
    };

    // Bootstrap
    useEffect(() => {
        if (!canvasReference.current || !projectPath || !manifest) return;
        let destroyed = false;
        bootstrapEngine({
            assetResolver: (url: string) => {
                if (projectPath && !url.startsWith('http')) return convertFileSrc(projectPath + url);
                return url;
            },
            canvas: canvasReference.current,
            characters, config: {
                audio: { muted: isMuted },
                display: { height: 720, scaleMode: 'fit', width: 1280 },
                onSceneNavigation: () => 'skip',
                theme: { boxColor: 0x00_00_33, fontFamily: 'Courier New', fontSize: 24 },
            }, defaultBlipUrl: '/assets/sfx/blip.wav', items, macros,
            manifest,
            scenes,
        }).then(engine => {
            if (destroyed) { engine.destroy(); return; }
            engine.persistentState.projectPath = projectPath;
            engineReference.current = engine;
            engine.setInputEnabled(false);
            engine.scenes.addScene('preview', script);
            engine.scenes.jumpToScene('preview');
        });
        return () => { destroyed = true; engineReference.current?.destroy(); engineReference.current = null; };
    }, [projectPath, manifest]);

    // Sync
    useEffect(() => {
        if (engineReference.current) engineReference.current.scenes.addScene('preview', script);
    }, [script]);

    // Play
    useEffect(() => {
        if (engineReference.current && playTrigger > 0) {
            const startIndex = typeof playFromIndex === 'number' ? playFromIndex : 0;
            engineReference.current.clear();
            engineReference.current.scenes.addScene('preview', script);
            engineReference.current.scenes.jumpToScene('preview', startIndex);
            engineReference.current.start();
            containerReference.current?.focus();
        }
    }, [playTrigger]);

    useEffect(() => {
        if (engineReference.current && stopTrigger > 0) {
            engineReference.current.clear();
            engineReference.current.scenes.addScene('preview', script);
            engineReference.current.scenes.jumpToScene('preview', 0);
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
            {!isFocused && engineReference.current?.isStarted && (
                <div style={{ background: 'rgba(0,0,0,0.6)', borderRadius: '4px', bottom: 10, color: '#aaa', fontSize: '10px', padding: '4px 8px', pointerEvents: 'none', position: 'absolute', right: 10 }}>
                    Click to control
                </div>
            )}
        </div>
    );
}