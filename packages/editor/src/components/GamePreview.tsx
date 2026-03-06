import { useEffect, useRef } from 'react';
import { Engine, bootstrapEngine } from 'core';
import { useProjectStore } from "../store/useProjectStore.ts";
import { convertFileSrc } from "@tauri-apps/api/core";

export function GamePreview({ script }: { script: any[] }) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const engineRef = useRef<Engine | null>(null);

    const projectPath = useProjectStore(state => state.projectPath);

    useEffect(() => {
        if (!canvasRef.current) return;

        let destroyed = false;

        bootstrapEngine({
            canvas: canvasRef.current,
            config: {
                display: { width: 1280, height: 720, scaleMode: 'fit' },
                theme: { fontFamily: 'Courier New', fontSize: 24, boxColor: 0x000033 }
            },
            isEditor: true,
            assetResolver: (url: string) => {
                if (projectPath && !url.startsWith('http')) {
                    return convertFileSrc(projectPath + url.replace(/\//g, '\\'));
                }
                return url;
            },
        }).then(engine => {
            if (destroyed) {
                engine.destroy();
                return;
            }

            engine.persistentState.projectPath = projectPath;
            engineRef.current = engine;

            engine.scenes.addScene('preview', script);
            engine.jumpToScene('preview');
            engine.start();
        });

        return () => {
            destroyed = true;
            engineRef.current?.destroy();
            engineRef.current = null;
        };
    }, [projectPath]);

    useEffect(() => {
        if (engineRef.current && script.length > 0) {
            const engine = engineRef.current;
            engine.scenes.addScene('preview', script);
            engine.jumpToScene('preview');

            if (!engine.isStarted) engine.start();
        }
    }, [script]);

    return (
        <div style={{ position: 'relative', width: '100%', height: '100%', backgroundColor: '#000', overflow: 'hidden' }}>
            <canvas ref={canvasRef} />
        </div>
    );
}