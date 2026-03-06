import { useEffect, useRef } from 'react';
import { Engine, BuiltInHandlers, DialogueHandler, ChoiceHandler } from 'core';
import { useProjectStore } from "../store/useProjectStore.ts";
import { convertFileSrc } from "@tauri-apps/api/core";

export function GamePreview({ script }: { script: any[] }) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const engineRef = useRef<Engine | null>(null);

    const projectPath = useProjectStore(state => state.projectPath);

    useEffect(() => {
        if (!canvasRef.current) return;

        const engine = new Engine({
            display: { width: 1280, height: 720, scaleMode: 'fit' },
            theme: { fontFamily: 'Courier New', fontSize: 24, boxColor: 0x000033 }
        });

        engine.isEditor = true;
        engine.persistentState.projectPath = projectPath;

        engine.assetResolver = (url: string) => {
            if (projectPath && !url.startsWith('http')) {
                return convertFileSrc(projectPath + url.replace(/\//g, '\\'));
            }
            return url;
        };

        engine.registerHandlers(BuiltInHandlers);
        engine.registerHandler(new DialogueHandler({ ...engine.theme }));
        engine.registerHandler(new ChoiceHandler({ ...engine.theme }));

        engine.init(canvasRef.current).then(() => {
            engineRef.current = engine;

            engine.scenes.addScene('preview', script);
            engine.jumpToScene('preview');
            engine.start();
        });

        return () => {
            engine.destroy();
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