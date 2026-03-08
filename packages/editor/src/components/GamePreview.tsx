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
    const engineReference = useRef<Engine>(); // Use undefined
    const [isFocused, setIsFocused] = useState(false);
    const [isStarted, setIsStarted] = useState(false);

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
        void bootstrapEngine({
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
            void engine.scenes.jumpToScene('preview');
        });
        return () => { destroyed = true; engineReference.current?.destroy(); engineReference.current = undefined; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [projectPath, manifest]);

    // Sync
    const scriptReference = useRef(script);
    useEffect(() => {
        scriptReference.current = script;
         
        if (engineReference.current) engineReference.current.scenes.addScene('preview', script);
    }, [script]);

    const playFromIndexReference = useRef(playFromIndex);
    useEffect(() => { playFromIndexReference.current = playFromIndex; }, [playFromIndex]);

    // Play
    useEffect(() => {
        if (engineReference.current && playTrigger > 0) {
            const startIndex = typeof playFromIndexReference.current === 'number' ? playFromIndexReference.current : 0;
            engineReference.current.clear();
             
            engineReference.current.scenes.addScene('preview', scriptReference.current);
            void engineReference.current.scenes.jumpToScene('preview', startIndex);
            void engineReference.current.start();
            setIsStarted(true);
            containerReference.current?.focus();
        }
    }, [playTrigger]);

    useEffect(() => {
        if (engineReference.current && stopTrigger > 0) {
            engineReference.current.clear();
             
            engineReference.current.scenes.addScene('preview', scriptReference.current);
            void engineReference.current.scenes.jumpToScene('preview', 0);
            setIsStarted(false);
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