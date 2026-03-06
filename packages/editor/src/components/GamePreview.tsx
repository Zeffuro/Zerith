import { useEffect, useRef, useState } from 'react';
import { Engine, bootstrapEngine } from 'core';
import { useProjectStore } from "../store/useProjectStore.ts";
import { convertFileSrc } from "@tauri-apps/api/core";

export function GamePreview({ script }: { script: any[] }) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const engineRef = useRef<Engine | null>(null);
    const [isFocused, setIsFocused] = useState(false);

    const {
        projectPath, manifest, characters, items, macros, scenes,
        playTrigger, stopTrigger, isMuted
    } = useProjectStore();

    const handleFocus = () => {
        setIsFocused(true);
        engineRef.current?.setInputEnabled(true);
    };

    const handleBlur = () => {
        setIsFocused(false);
        engineRef.current?.setInputEnabled(false);
    };

    // Bootstrap
    useEffect(() => {
        if (!canvasRef.current || !projectPath || !manifest) return;
        let destroyed = false;
        bootstrapEngine({
            canvas: canvasRef.current,
            config: {
                display: { width: 1280, height: 720, scaleMode: 'fit' },
                theme: { fontFamily: 'Courier New', fontSize: 24, boxColor: 0x000033 },
                audio: { muted: isMuted }
            },
            manifest, characters, items, macros, scenes,
            defaultBlipUrl: '/assets/sfx/blip.wav',
            isEditor: true,
            assetResolver: (url: string) => {
                if (projectPath && !url.startsWith('http')) return convertFileSrc(projectPath + url);
                return url;
            },
        }).then(engine => {
            if (destroyed) { engine.destroy(); return; }
            engine.persistentState.projectPath = projectPath;
            engineRef.current = engine;
            engine.setInputEnabled(false);
            engine.scenes.addScene('preview', script);
            engine.jumpToScene('preview');
        });
        return () => { destroyed = true; engineRef.current?.destroy(); engineRef.current = null; };
    }, [projectPath, manifest]);

    // Sync
    useEffect(() => {
        if (engineRef.current) engineRef.current.scenes.addScene('preview', script);
    }, [script]);

    // Play
    useEffect(() => {
        if (engineRef.current && playTrigger > 0) {
            engineRef.current.clear();
            engineRef.current.scenes.addScene('preview', script);
            engineRef.current.jumpToScene('preview', 0);
            engineRef.current.start();
            containerRef.current?.focus();
        }
    }, [playTrigger]);

    useEffect(() => {
        if (engineRef.current && stopTrigger > 0) {
            engineRef.current.clear();
            engineRef.current.scenes.addScene('preview', script);
            engineRef.current.jumpToScene('preview', 0);
            containerRef.current?.blur();
        }
    }, [stopTrigger]);

    // Mute
    useEffect(() => {
        if (engineRef.current) {
            engineRef.current.audio.muted = isMuted;
        }
    }, [isMuted]);

    return (
        <div
            ref={containerRef}
            tabIndex={0}
            onFocus={handleFocus}
            onBlur={handleBlur}
            style={{
                position: 'relative', width: '100%', height: '100%', backgroundColor: '#000',
                overflow: 'hidden', outline: 'none',
                border: isFocused ? '2px solid #007fd4' : '2px solid transparent',
                transition: 'border-color 0.2s'
            }}
        >
            <canvas ref={canvasRef} />
            {!isFocused && engineRef.current?.isStarted && (
                <div style={{ position: 'absolute', bottom: 10, right: 10, padding: '4px 8px', background: 'rgba(0,0,0,0.6)', color: '#aaa', fontSize: '10px', borderRadius: '4px', pointerEvents: 'none' }}>
                    Click to control
                </div>
            )}
        </div>
    );
}