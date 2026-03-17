import type { Script } from 'core';

import { useEffect, useRef, useState } from 'react';

import { useEngineLifecycle } from '../hooks/useEngineLifecycle';
import { useEngineMute } from '../hooks/useEngineMute';
import { usePlaybackControl } from '../hooks/usePlaybackControl';
import { useProjectStore } from '../store/storeBootstrap';
import { useConsoleStore } from '../store/useConsoleStore';
import { useEditorStore } from '../store/useEditorStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { editorTheme as t } from '../theme/editorTheme';

export function GamePreview({ script }: { script: Script }) {
    // Manifest data
    const { activeFile, characters, items, macros, manifest, projectPath, scenes, treeRevision } = useProjectStore();
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
    const setPreviewLogCaptureEnabled = useConsoleStore((state) => state.setPreviewLogCaptureEnabled);

    const canvasReference = useRef<HTMLCanvasElement>(null);
    const containerReference = useRef<HTMLDivElement>(null);
    const [isFocused, setIsFocused] = useState(false);
    const isStarted = playTrigger > stopTrigger;
    const playbackRequestIdReference = useRef(0);
    const scriptReference = useRef(script);
    const projectDataReference = useRef({ characters, items, macros, scenes });
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
        scriptReference.current = script;
    }, [script]);

    useEffect(() => {
        projectDataReference.current = { characters, items, macros, scenes };
    }, [characters, items, macros, scenes]);

    useEffect(() => {
        activeFileReference.current = activeFile;
    }, [activeFile]);

    const engineReference = useEngineLifecycle({
        activeFileReference,
        canvasReference,
        containerReference,
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
            tabIndex={0}
        >
            <canvas ref={canvasReference} />
            {!isFocused && isStarted && (
                <div
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


